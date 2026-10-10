using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Placement;
using FourUme.Application.Review;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Vocabulary;

public class VocabularyService(IAppDbContext db, IActivityService activity) : IVocabularyService
{
    public async Task<IReadOnlyList<DeckSummaryDto>> GetDecksAsync(Guid userId, string? level, CancellationToken ct = default)
    {
        var wordsQuery = db.Words.AsNoTracking().Where(w => w.Published && w.Deck.Published);
        if (!string.IsNullOrWhiteSpace(level))
        {
            var lv = level.Trim().ToUpperInvariant();
            wordsQuery = wordsQuery.Where(w => w.Level == lv);
        }

        var counts = await wordsQuery
            .GroupBy(w => w.DeckId)
            .Select(g => new
            {
                DeckId = g.Key,
                Total = g.Count(),
                Levels = string.Join(",", g.Select(x => x.Level).Distinct().OrderBy(x => x))
            })
            .ToDictionaryAsync(x => x.DeckId, ct);

        var decks = await db.Decks.AsNoTracking()
            .Where(d => d.Published)
            .OrderBy(d => d.SortOrder).ThenBy(d => d.TitleVi)
            .ToListAsync(ct);

        var progress = await db.WordProgresses.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Join(db.Words.AsNoTracking().Where(w => w.Published), p => p.WordId, w => w.Id, (p, w) => new { w.DeckId, p.Status })
            .ToListAsync(ct);

        return decks
            .Where(d => counts.ContainsKey(d.Id))
            .Select(d =>
            {
                var c = counts[d.Id];
                var deckProgress = progress.Where(p => p.DeckId == d.Id).ToList();
                return new DeckSummaryDto(
                    d.Id,
                    d.TitleVi,
                    d.Icon,
                    c.Total,
                    deckProgress.Count(p => p.Status == WordStatus.Known),
                    deckProgress.Count(p => p.Status == WordStatus.Hard),
                    c.Levels);
            }).ToList();
    }

    public async Task<IReadOnlyList<WordDto>> GetDeckWordsAsync(Guid userId, string deckId, CancellationToken ct = default)
    {
        var words = await db.Words.AsNoTracking()
            .Where(w => w.DeckId == deckId && w.Published)
            .ToListAsync(ct);

        var progress = await (
            from p in db.WordProgresses.AsNoTracking()
            join w in db.Words.AsNoTracking() on p.WordId equals w.Id
            where p.UserId == userId && w.DeckId == deckId
            select new { p.WordId, p.Status, p.UpdatedAt }
        ).ToDictionaryAsync(x => x.WordId, ct);

        var startRank = PlacementRules.Rank(await db.Users.AsNoTracking()
            .Where(u => u.Id == userId).Select(u => u.VocabLevel).FirstOrDefaultAsync(ct));

        // Study order: "learn later" (Hard) words first, oldest postponement first; then new words
        // in curriculum order, words below the learner's start level after the rest; known words last.
        return words
            .Select(w =>
            {
                var p = progress.GetValueOrDefault(w.Id);
                return new
                {
                    Dto = new WordDto(
                        w.Id, w.Text, w.Ipa, w.Pos, w.Level, w.MeaningVi, w.Example, w.ExampleVi, w.PublicImageUrl,
                        p?.Status ?? WordStatus.New, WordForms.Describe(w.Text, w.Pos)),
                    w.SortOrder,
                    Easy = PlacementRules.Rank(w.Level) < startRank,
                    UpdatedAt = p?.UpdatedAt ?? DateTimeOffset.MinValue
                };
            })
            .OrderBy(x => x.Dto.Status switch { WordStatus.Hard => 0, WordStatus.New => x.Easy ? 2 : 1, _ => 3 })
            .ThenBy(x => x.Dto.Status == WordStatus.Hard ? x.UpdatedAt : DateTimeOffset.MinValue)
            .ThenBy(x => x.SortOrder)
            .Select(x => x.Dto)
            .ToList();
    }

    public const int MaxSearchResults = 50;

    public async Task<IReadOnlyList<WordSearchResultDto>> SearchAsync(Guid userId, string query, int limit, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];
        var hits = await WordSearchIndex.SearchAsync(db, query, Math.Clamp(limit, 1, MaxSearchResults), ct);
        if (hits.Count == 0) return [];
        var ids = hits.Select(h => h.Id).ToList();
        var matchedForm = query.Trim().ToLowerInvariant();

        var words = await db.Words.AsNoTracking().Include(w => w.Deck)
            .Where(w => ids.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, ct);
        var status = await db.WordProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && ids.Contains(p.WordId))
            .ToDictionaryAsync(p => p.WordId, p => p.Status, ct);

        return hits
            .Where(h => words.ContainsKey(h.Id))
            .Select(h =>
            {
                var w = words[h.Id];
                return new WordSearchResultDto(
                    new WordDto(w.Id, w.Text, w.Ipa, w.Pos, w.Level, w.MeaningVi, w.Example, w.ExampleVi, w.PublicImageUrl,
                        status.GetValueOrDefault(h.Id, WordStatus.New), WordForms.Describe(w.Text, w.Pos)),
                    w.DeckId,
                    w.Deck.TitleVi,
                    h.ViaForm ? matchedForm : null);
            })
            .ToList();
    }

    public async Task<UpdateProgressResponse> UpdateProgressAsync(Guid userId, UpdateProgressRequest request, CancellationToken ct = default)
    {
        var exists = await db.Words.AnyAsync(w => w.Id == request.WordId, ct);
        if (!exists)
        {
            throw new InvalidOperationException("Không tìm thấy từ.");
        }

        var progress = await db.WordProgresses.FirstOrDefaultAsync(p => p.UserId == userId && p.WordId == request.WordId, ct);
        if (progress is null)
        {
            progress = new WordProgress { UserId = userId, WordId = request.WordId };
            db.WordProgresses.Add(progress);
        }

        var wasKnown = progress.Status == WordStatus.Known;
        var now = DateTimeOffset.UtcNow;
        progress.Status = request.Status;
        progress.UpdatedAt = now;
        progress.LapseCount = 0;
        progress.FromPlacement = false;
        if (request.Status == WordStatus.Known)
        {
            progress.ReviewLevel = ReviewSchedule.FirstLevel;
            progress.NextReviewAt = ReviewSchedule.NextReviewAt(ReviewSchedule.FirstLevel, now);
        }
        else
        {
            progress.ReviewLevel = 0;
            progress.NextReviewAt = null;
        }

        await db.SaveChangesAsync(ct);

        if (request.Status == WordStatus.Known && !wasKnown) await activity.RecordAsync(userId, ActivityKind.NewWord, ct);
        else if (request.Status == WordStatus.Hard) await activity.RecordAsync(userId, ActivityKind.Studied, ct);

        return new UpdateProgressResponse(progress.WordId, progress.Status, progress.NextReviewAt);
    }
}
