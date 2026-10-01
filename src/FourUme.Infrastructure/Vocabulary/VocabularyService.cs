using FourUme.Application.Abstractions;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Vocabulary;

public class VocabularyService(IAppDbContext db) : IVocabularyService
{
    public async Task<IReadOnlyList<DeckSummaryDto>> GetDecksAsync(Guid userId, string? level, CancellationToken ct = default)
    {
        var wordsQuery = db.Words.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(level))
        {
            var lv = level.Trim().ToUpperInvariant();
            wordsQuery = wordsQuery.Where(w => w.Level == lv);
        }

        var decks = await wordsQuery
            .GroupBy(w => new { w.DeckId, w.DeckTitleVi })
            .Select(g => new
            {
                g.Key.DeckId,
                g.Key.DeckTitleVi,
                Total = g.Count(),
                Levels = string.Join(",", g.Select(x => x.Level).Distinct().OrderBy(x => x))
            })
            .OrderBy(d => d.DeckTitleVi)
            .ToListAsync(ct);

        var progress = await db.WordProgresses.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Join(db.Words.AsNoTracking(), p => p.WordId, w => w.Id, (p, w) => new { w.DeckId, p.Status })
            .ToListAsync(ct);

        return decks.Select(d =>
        {
            var deckProgress = progress.Where(p => p.DeckId == d.DeckId).ToList();
            return new DeckSummaryDto(
                d.DeckId,
                d.DeckTitleVi,
                d.Total,
                deckProgress.Count(p => p.Status == WordStatus.Known),
                deckProgress.Count(p => p.Status == WordStatus.Hard),
                d.Levels);
        }).ToList();
    }

    public async Task<IReadOnlyList<WordDto>> GetDeckWordsAsync(Guid userId, string deckId, CancellationToken ct = default)
    {
        var words = await db.Words.AsNoTracking()
            .Where(w => w.DeckId == deckId)
            .OrderBy(w => w.Text)
            .ToListAsync(ct);

        var statuses = await (
            from p in db.WordProgresses.AsNoTracking()
            join w in db.Words.AsNoTracking() on p.WordId equals w.Id
            where p.UserId == userId && w.DeckId == deckId
            select new { p.WordId, p.Status }
        ).ToDictionaryAsync(x => x.WordId, x => x.Status, ct);

        // Prioritize unknown / hard first for study sessions
        return words
            .Select(w => new WordDto(
                w.Id, w.Text, w.Ipa, w.Pos, w.Level, w.MeaningVi, w.Example, w.ExampleVi,
                statuses.GetValueOrDefault(w.Id, WordStatus.New)))
            .OrderBy(w => w.Status == WordStatus.Known ? 2 : w.Status == WordStatus.Hard ? 0 : 1)
            .ThenBy(w => w.Word)
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

        progress.Status = request.Status;
        progress.UpdatedAt = DateTimeOffset.UtcNow;
        progress.NextReviewAt = request.Status switch
        {
            WordStatus.Known => DateTimeOffset.UtcNow.AddDays(3),
            WordStatus.Hard => DateTimeOffset.UtcNow.AddHours(4),
            _ => DateTimeOffset.UtcNow.AddMinutes(10)
        };

        await db.SaveChangesAsync(ct);
        return new UpdateProgressResponse(progress.WordId, progress.Status, progress.NextReviewAt);
    }
}
