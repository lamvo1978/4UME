using FourUme.Application.Admin;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Vocabulary;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public partial class AdminContentService
{
    private const int MaxImportRows = 3000;

    private static readonly Dictionary<string, string> PosAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["n"] = "noun", ["danh từ"] = "noun",
        ["v"] = "verb", ["động từ"] = "verb",
        ["adj"] = "adjective", ["tính từ"] = "adjective",
        ["adv"] = "adverb", ["trạng từ"] = "adverb",
        ["prep"] = "preposition", ["giới từ"] = "preposition",
        ["pron"] = "pronoun", ["đại từ"] = "pronoun",
        ["det"] = "determiner", ["hạn định từ"] = "determiner", ["từ hạn định"] = "determiner",
        ["conj"] = "conjunction", ["liên từ"] = "conjunction",
        ["interj"] = "interjection", ["thán từ"] = "interjection",
        ["num"] = "number", ["số từ"] = "number",
    };

    private sealed record ImportPlan(ImportWordRow Row, Word? Target, WordSnapshot Values);

    public async Task<ImportWordsResult> ImportWordsAsync(ImportWordsRequest request, CancellationToken ct = default)
    {
        if (request.Rows.Count == 0) throw new InvalidOperationException("File không có dòng dữ liệu nào.");
        if (request.Rows.Count > MaxImportRows) throw new InvalidOperationException($"Mỗi lần nhập tối đa {MaxImportRows} dòng.");

        var words = await db.Words.ToListAsync(ct);
        var byId = words.ToDictionary(w => w.Id);
        var byKey = words.GroupBy(w => Key(w.Text, w.Pos)).ToDictionary(g => g.Key, g => g.First());
        var decks = await db.Decks.AsNoTracking().ToListAsync(ct);
        var deckIds = decks.ToDictionary(d => d.Id, d => d.Id, StringComparer.OrdinalIgnoreCase);
        var deckTitles = decks.GroupBy(d => Fold(d.TitleVi)).ToDictionary(g => g.Key, g => g.First().Id);

        var seenKeys = new Dictionary<string, int>();
        var seenTargets = new Dictionary<string, int>();
        var results = new List<ImportWordRowResult>();
        var plans = new List<ImportPlan>();

        foreach (var row in request.Rows)
        {
            var messages = new List<string>();
            Word? target = null;
            var id = row.Id?.Trim();
            if (!string.IsNullOrEmpty(id) && !byId.TryGetValue(id, out target))
                messages.Add($"Không có từ nào mang mã \"{id}\".");

            var text = (row.Word ?? target?.Text ?? "").Trim();
            if (text.Length == 0) messages.Add("Thiếu từ.");
            else if (text.Length > 120) messages.Add("Từ dài quá 120 ký tự.");

            var pos = target?.Pos ?? "";
            if (!string.IsNullOrWhiteSpace(row.Pos))
            {
                if (NormalizePos(row.Pos) is { } p) pos = p;
                else messages.Add($"Loại từ \"{row.Pos.Trim()}\" không hợp lệ.");
            }
            else if (target is null) messages.Add("Thiếu loại từ.");

            var matchedByKey = false;
            if (target is null && string.IsNullOrEmpty(id) && pos.Length > 0 && byKey.TryGetValue(Key(text, pos), out var existing))
            {
                target = existing;
                matchedByKey = true;
            }

            var level = (row.Level ?? target?.Level ?? "").Trim().ToUpperInvariant();
            if (level.Length == 0) messages.Add("Thiếu cấp độ.");
            else if (!ContentRules.Levels.Contains(level)) messages.Add($"Cấp độ \"{level}\" không hợp lệ.");

            var deckId = target?.DeckId ?? "";
            if (!string.IsNullOrWhiteSpace(row.Deck))
            {
                var d = row.Deck.Trim();
                if (deckIds.TryGetValue(d, out var byDeckId)) deckId = byDeckId;
                else if (deckTitles.TryGetValue(Fold(d), out var byTitle)) deckId = byTitle;
                else messages.Add($"Không có bộ từ \"{d}\".");
            }
            else if (target is null) messages.Add("Thiếu bộ từ.");

            var meaning = (row.MeaningVi ?? target?.MeaningVi ?? "").Trim();
            if (meaning.Length == 0) messages.Add("Thiếu nghĩa tiếng Việt.");
            else if (meaning.Length > 500) messages.Add("Nghĩa tiếng Việt dài quá 500 ký tự.");

            var image = row.ImageUrl is null ? target?.ImageUrl : row.ImageUrl.Trim();
            if (string.IsNullOrEmpty(image)) image = null;
            else if (!image.StartsWith(MediaOptions.UrlPrefix + "/") && !Uri.TryCreate(image, UriKind.Absolute, out _))
                messages.Add("Đường dẫn ảnh không hợp lệ.");

            var published = target?.Published ?? true;
            if (!string.IsNullOrWhiteSpace(row.Published))
            {
                if (ParseBool(row.Published) is { } b) published = b;
                else messages.Add($"Cột hiện/ẩn \"{row.Published.Trim()}\" không hiểu được (dùng 1/0, có/không).");
            }

            var values = new WordSnapshot(
                target?.Id ?? "", deckId, text, (row.Ipa ?? target?.Ipa ?? "").Trim(), pos, level, meaning,
                (row.Example ?? target?.Example ?? "").Trim(), (row.ExampleVi ?? target?.ExampleVi ?? "").Trim(), image, published);

            var repeatsTarget = false;
            if (target is not null)
            {
                if (seenTargets.TryGetValue(target.Id, out var line))
                {
                    messages.Add($"Dòng {line} cũng sửa từ này.");
                    repeatsTarget = true;
                }
                else seenTargets[target.Id] = row.Line;
            }
            if (text.Length > 0 && pos.Length > 0)
            {
                var key = Key(text, pos);
                if (seenKeys.TryGetValue(key, out var line))
                {
                    if (!repeatsTarget) messages.Add($"Trùng với dòng {line} trong file.");
                }
                else seenKeys[key] = row.Line;
                if (byKey.TryGetValue(key, out var other) && other.Id != target?.Id)
                    messages.Add($"Đã có từ \"{other.Text}\" ({other.Pos}) với mã {other.Id}.");
            }

            var changes = target is null ? [] : Changes(Auditor.Snapshot(target), values);
            string status;
            if (messages.Count > 0) status = ImportStatus.Error;
            else if (target is null) status = ImportStatus.Create;
            else if (changes.Count == 0) status = ImportStatus.Unchanged;
            else if (matchedByKey && !request.UpdateExisting) status = ImportStatus.Duplicate;
            else status = ImportStatus.Update;

            if (status == ImportStatus.Duplicate) messages.Add("Đã có từ này. Bật \"Cập nhật từ đã có\" để ghi đè.");
            if (status is ImportStatus.Create or ImportStatus.Update) plans.Add(new ImportPlan(row, target, values));
            results.Add(new ImportWordRowResult(row.Line, text, pos, status, target?.Id, messages, changes));
        }

        var committed = false;
        if (request.Commit && plans.Count > 0)
        {
            var ids = new HashSet<string>(byId.Keys);
            var order = words.Count == 0 ? 0 : words.Max(w => w.SortOrder) + 1;
            var now = DateTimeOffset.UtcNow;
            foreach (var (row, target, v) in plans)
            {
                var word = target;
                var before = target is null ? null : Auditor.Snapshot(target);
                if (word is null)
                {
                    var baseId = $"{Slug(v.Word)}-{v.Pos}";
                    var newId = baseId;
                    for (var n = 2; ids.Contains(newId); n++) newId = $"{baseId}-{n}";
                    ids.Add(newId);
                    word = new Word { Id = newId, SortOrder = order++ };
                    db.Words.Add(word);
                }
                word.Text = v.Word;
                word.Pos = v.Pos;
                word.Level = v.Level;
                word.DeckId = v.DeckId;
                word.Ipa = v.Ipa;
                word.MeaningVi = v.MeaningVi;
                word.Example = v.Example;
                word.ExampleVi = v.ExampleVi;
                if (v.ImageUrl != word.ImageUrl) word.ImagePending = false;
                word.ImageUrl = v.ImageUrl;
                word.Published = v.Published;
                word.EditedAt = now;
                auditor.Record(AuditEntities.Word, word.Id, AuditActions.Import, word.Text, before, Auditor.Snapshot(word));
                var index = results.FindIndex(r => r.Line == row.Line);
                results[index] = results[index] with { Id = word.Id };
            }
            await db.SaveChangesAsync(ct);
            WordSearchIndex.Invalidate();
            committed = true;
        }

        return new ImportWordsResult(
            results.Count(r => r.Status == ImportStatus.Create),
            results.Count(r => r.Status == ImportStatus.Update),
            results.Count(r => r.Status == ImportStatus.Unchanged),
            results.Count(r => r.Status == ImportStatus.Duplicate),
            results.Count(r => r.Status == ImportStatus.Error),
            committed,
            results);
    }

    private static string Key(string text, string pos) => $"{text.Trim().ToLowerInvariant()}|{pos}";

    private static string Fold(string s) => WordSearchIndex.Fold(s.Trim().ToLowerInvariant());

    /// <summary>Accepts "noun", "n", "danh từ" and the admin's own "noun (danh từ)" label.</summary>
    private static string? NormalizePos(string raw)
    {
        var v = raw.Trim();
        var paren = v.IndexOf('(');
        if (paren > 0) v = v[..paren].Trim();
        v = v.TrimEnd('.').ToLowerInvariant();
        if (ContentRules.PartsOfSpeech.Contains(v)) return v;
        return PosAliases.GetValueOrDefault(v);
    }

    private static bool? ParseBool(string raw) => raw.Trim().ToLowerInvariant() switch
    {
        "1" or "true" or "yes" or "y" or "x" or "có" or "co" or "hiện" or "hien" => true,
        "0" or "false" or "no" or "n" or "không" or "khong" or "ẩn" or "an" => false,
        _ => null,
    };

    private static List<string> Changes(WordSnapshot a, WordSnapshot b)
    {
        var changes = new List<string>();
        if (a.Word != b.Word) changes.Add("word");
        if (a.Pos != b.Pos) changes.Add("pos");
        if (a.Level != b.Level) changes.Add("level");
        if (a.DeckId != b.DeckId) changes.Add("deck");
        if (a.MeaningVi != b.MeaningVi) changes.Add("meaningVi");
        if (a.Ipa != b.Ipa) changes.Add("ipa");
        if (a.Example != b.Example) changes.Add("example");
        if (a.ExampleVi != b.ExampleVi) changes.Add("exampleVi");
        if (a.ImageUrl != b.ImageUrl) changes.Add("imageUrl");
        if (a.Published != b.Published) changes.Add("published");
        return changes;
    }
}
