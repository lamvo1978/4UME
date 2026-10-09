using System.Globalization;
using System.Text;
using FourUme.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Vocabulary;

/// <summary>
/// In-memory index over the word list (a few thousand rows) so search can ignore Vietnamese
/// diacritics without a Postgres extension. Rebuilt every few minutes to pick up content edits.
/// </summary>
internal static class WordSearchIndex
{
    private sealed record Entry(string Id, string Word, string WordFolded, string MeaningLower, string MeaningFolded, string[] Senses, int LevelRank, int SortOrder);

    private static readonly TimeSpan MaxAge = TimeSpan.FromMinutes(10);
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static List<Entry> _entries = [];
    private static DateTimeOffset _builtAt = DateTimeOffset.MinValue;

    /// <summary>Matching word ids, best first. <c>ViaForm</c> is set when the query is an inflected form ("went" → go).</summary>
    public static async Task<IReadOnlyList<(string Id, bool ViaForm)>> SearchAsync(IAppDbContext db, string query, int limit, CancellationToken ct)
    {
        var entries = await GetEntriesAsync(db, ct);
        var lower = query.Trim().ToLowerInvariant();
        var folded = Fold(lower);
        if (folded.Length == 0) return [];
        var bases = lower == folded
            ? WordForms.BaseCandidates(folded).Where(b => b != folded).ToHashSet()
            : [];

        return entries
            .Select(e => (e, Rank: bases.Contains(e.WordFolded) ? FormMatchRank : Rank(e, lower, folded)))
            .Where(x => x.Rank < int.MaxValue)
            .OrderBy(x => x.Rank)
            .ThenBy(x => x.e.LevelRank)
            .ThenBy(x => x.e.Word.Length)
            .ThenBy(x => x.e.SortOrder)
            .Take(limit)
            .Select(x => (x.e.Id, x.Rank == FormMatchRank))
            .ToList();
    }

    private const int FormMatchRank = 5;

    /// <summary>
    /// Lower is better; int.MaxValue = no match. A query with diacritics is clearly Vietnamese, so it skips
    /// English-word matching and prefers meanings with the same accents.
    /// </summary>
    private static int Rank(Entry e, string lower, string folded)
    {
        var vietnamese = lower != folded;
        if (!vietnamese)
        {
            if (e.WordFolded == folded) return 0;
            if (e.WordFolded.StartsWith(folded, StringComparison.Ordinal)) return 10;
        }
        var accentPenalty = vietnamese && !e.MeaningLower.Contains(lower, StringComparison.Ordinal) ? 100 : 0;
        var core = StripClassifier(folded);
        if (e.Senses.Contains(folded)) return 20 + accentPenalty;
        if (e.Senses.Any(s => StripClassifier(s) == core)) return 25 + accentPenalty;
        if (e.Senses.Any(s => s.StartsWith(folded + " ", StringComparison.Ordinal))) return 30 + accentPenalty;
        if (!vietnamese && folded.Length >= 3 && e.WordFolded.Contains(folded, StringComparison.Ordinal)) return 40;
        if (folded.Length >= 2 && ContainsWord(e.MeaningFolded, folded)) return 50 + accentPenalty;
        return int.MaxValue;
    }

    private static readonly string[] Classifiers =
        ["con ", "cai ", "chiec ", "qua ", "su ", "viec ", "mot cach ", "cuon "];

    /// <summary>Users type "con mèo" while the stored meaning is "mèo" (or the reverse).</summary>
    private static string StripClassifier(string folded)
    {
        foreach (var c in Classifiers)
            if (folded.StartsWith(c, StringComparison.Ordinal) && folded.Length > c.Length) return folded[c.Length..];
        return folded;
    }

    private static bool ContainsWord(string text, string term)
    {
        var i = text.IndexOf(term, StringComparison.Ordinal);
        while (i >= 0)
        {
            var startOk = i == 0 || !char.IsLetterOrDigit(text[i - 1]);
            var end = i + term.Length;
            var endOk = end == text.Length || !char.IsLetterOrDigit(text[end]);
            if (startOk && endOk) return true;
            i = text.IndexOf(term, i + 1, StringComparison.Ordinal);
        }
        return false;
    }

    private static async Task<List<Entry>> GetEntriesAsync(IAppDbContext db, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow - _builtAt < MaxAge) return _entries;
        await Gate.WaitAsync(ct);
        try
        {
            if (DateTimeOffset.UtcNow - _builtAt < MaxAge) return _entries;
            var rows = await db.Words.AsNoTracking()
                .Where(w => w.Published && w.Deck.Published)
                .Select(w => new { w.Id, w.Text, w.MeaningVi, w.Level, w.SortOrder })
                .ToListAsync(ct);
            _entries = rows.Select(r =>
            {
                var meaningLower = r.MeaningVi.ToLowerInvariant();
                var meaningFolded = Fold(meaningLower);
                var senses = meaningFolded.Split([',', ';', '/'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                return new Entry(r.Id, r.Text, Fold(r.Text.ToLowerInvariant()), meaningLower, meaningFolded, senses, LevelRank(r.Level), r.SortOrder);
            }).ToList();
            _builtAt = DateTimeOffset.UtcNow;
            return _entries;
        }
        finally
        {
            Gate.Release();
        }
    }

    /// <summary>Forces a rebuild on the next search (after admin edits).</summary>
    public static void Invalidate() => _builtAt = DateTimeOffset.MinValue;

    private static int LevelRank(string level) => level switch { "A1" => 0, "A2" => 1, "B1" => 2, "B2" => 3, _ => 4 };

    /// <summary>"Đường phố" → "duong pho".</summary>
    public static string Fold(string text)
    {
        var sb = new StringBuilder(text.Length);
        foreach (var c in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(c switch { 'đ' => 'd', 'Đ' => 'd', _ => c });
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).Trim();
    }
}
