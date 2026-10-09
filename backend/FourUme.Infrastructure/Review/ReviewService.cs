using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Review;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using FourUme.Infrastructure.Vocabulary;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Review;

public class ReviewService(IAppDbContext db, IActivityService activity, IClientClock clock) : IReviewService
{
    private const int OptionCount = 4;
    private const int MaxForecastDays = 14;

    private sealed record PoolWord(string Id, string Text, string Pos, string DeckId, string MeaningVi);

    public async Task<ReviewSummaryDto> GetSummaryAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var inReview = db.WordProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0);

        var due = await inReview.CountAsync(p => p.NextReviewAt <= now, ct);
        var total = await inReview.CountAsync(ct);
        var mastered = await inReview.CountAsync(p => p.ReviewLevel >= ReviewSchedule.MasteredLevel, ct);
        var nextDue = await inReview.Where(p => p.NextReviewAt > now).MinAsync(p => p.NextReviewAt, ct);

        return new ReviewSummaryDto(due, total, mastered, nextDue);
    }

    public async Task<IReadOnlyList<ReviewForecastDayDto>> GetForecastAsync(Guid userId, int days, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, MaxForecastDays);
        var today = clock.Today;
        var todayStart = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), clock.Offset).ToUniversalTime();
        var horizon = todayStart.AddDays(days);

        var words = await db.WordProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0 && p.NextReviewAt < horizon)
            .Select(p => p.NextReviewAt!.Value)
            .ToListAsync(ct);
        var grammar = await (
            from p in db.GrammarProgresses.AsNoTracking()
            join l in db.GrammarLessons.AsNoTracking() on p.LessonSlug equals l.Slug
            where p.UserId == userId && p.ReviewLevel > 0 && l.Published && p.NextReviewAt < horizon
            select p.NextReviewAt!.Value
        ).ToListAsync(ct);

        return Enumerable.Range(0, days)
            .Select(d =>
            {
                var end = todayStart.AddDays(d + 1);
                return new ReviewForecastDayDto(today.AddDays(d), words.Count(t => t < end), grammar.Count(t => t < end));
            })
            .ToList();
    }

    public async Task<IReadOnlyList<ReviewItemDto>> GetDueItemsAsync(Guid userId, int limit, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var due = await (
            from p in db.WordProgresses.AsNoTracking()
            join w in db.Words.AsNoTracking() on p.WordId equals w.Id
            where p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0 && p.NextReviewAt <= now
            orderby p.NextReviewAt
            select new { Word = w, p.ReviewLevel }
        ).Take(Math.Clamp(limit, 1, 50)).ToListAsync(ct);

        if (due.Count == 0) return [];

        var pool = await LoadPoolAsync(ct);
        var items = due.Select(d => BuildItem(d.Word, d.ReviewLevel, pool)).ToList();
        Shuffle(items);
        return items;
    }

    public async Task<IReadOnlyList<ReviewItemDto>> GetPracticeItemsAsync(Guid userId, PracticeQuery query, CancellationToken ct = default)
    {
        var known =
            from p in db.WordProgresses.AsNoTracking()
            join w in db.Words.AsNoTracking() on p.WordId equals w.Id
            where p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0
            select new { Word = w, p.ReviewLevel, p.LapseCount };

        if (query.WordIds is { Count: > 0 })
        {
            var ids = query.WordIds.ToArray();
            known = known.Where(k => ids.Contains(k.Word.Id));
        }
        else if (!string.IsNullOrWhiteSpace(query.DeckId)) known = known.Where(k => k.Word.DeckId == query.DeckId);

        var candidates = await known.ToListAsync(ct);
        if (candidates.Count == 0) return [];

        var picked = candidates
            .OrderBy(c => c.ReviewLevel <= ReviewSchedule.WeakLevel || c.LapseCount > 0 ? 0 : 1)
            .ThenBy(_ => Random.Shared.Next())
            .Take(Math.Clamp(query.Limit, 1, 50))
            .ToList();

        var pool = await LoadPoolAsync(ct);
        var items = picked.Select(c => BuildItem(c.Word, c.ReviewLevel, pool)).ToList();
        Shuffle(items);
        return items;
    }

    public async Task<PracticeAnswerResponse> PracticeAnswerAsync(Guid userId, ReviewAnswerRequest request, CancellationToken ct = default)
    {
        var progress = await db.WordProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WordId == request.WordId, ct);
        if (progress is null || progress.Status != WordStatus.Known || progress.ReviewLevel == 0)
        {
            throw new InvalidOperationException("Từ này không nằm trong danh sách ôn tập.");
        }

        var pulled = ReviewSchedule.ApplyPractice(progress, request.Mistakes, DateTimeOffset.UtcNow);
        if (pulled) await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Review, ct);
        return new PracticeAnswerResponse(progress.WordId, progress.NextReviewAt, pulled);
    }

    private Task<List<PoolWord>> LoadPoolAsync(CancellationToken ct) =>
        db.Words.AsNoTracking()
            .Select(w => new PoolWord(w.Id, w.Text, w.Pos, w.DeckId, w.MeaningVi))
            .ToListAsync(ct);

    public async Task<ReviewAnswerResponse> AnswerAsync(Guid userId, ReviewAnswerRequest request, CancellationToken ct = default)
    {
        var progress = await db.WordProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WordId == request.WordId, ct);
        if (progress is null || progress.Status != WordStatus.Known || progress.ReviewLevel == 0)
        {
            throw new InvalidOperationException("Từ này không nằm trong danh sách ôn tập.");
        }

        var outcome = ReviewSchedule.ApplyAnswer(progress, request.Mistakes, DateTimeOffset.UtcNow);
        var backToLearning = outcome == ReviewOutcome.Relearn;
        if (backToLearning)
        {
            progress.Status = WordStatus.Hard;
            progress.ReviewLevel = 0;
            progress.NextReviewAt = null;
        }

        await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Review, ct);
        return new ReviewAnswerResponse(progress.WordId, progress.ReviewLevel, progress.Status, progress.NextReviewAt, backToLearning);
    }

    private static ReviewItemDto BuildItem(Word word, int level, IReadOnlyList<PoolWord> pool)
    {
        var dto = new WordDto(
            word.Id, word.Text, word.Ipa, word.Pos, word.Level, word.MeaningVi, word.Example, word.ExampleVi,
            word.ImageUrl, WordStatus.Known, WordForms.Describe(word.Text, word.Pos));

        return new ReviewItemDto(level, dto,
            BuildOptions(word, pool, p => p.Text),
            BuildOptions(word, pool, p => p.MeaningVi));
    }

    /// <summary>Correct answer + distractors with the same part of speech, preferring the same deck.</summary>
    private static List<string> BuildOptions(Word word, IReadOnlyList<PoolWord> pool, Func<PoolWord, string> label)
    {
        var correct = word.Id;
        var answer = label(new PoolWord(word.Id, word.Text, word.Pos, word.DeckId, word.MeaningVi));
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { answer };

        // Reject near-synonyms ("chào" vs "xin chào") so only one option is defensible.
        bool Valid(PoolWord p) =>
            p.Id != correct
            && !string.Equals(p.Text, word.Text, StringComparison.OrdinalIgnoreCase)
            && !p.MeaningVi.Contains(word.MeaningVi, StringComparison.OrdinalIgnoreCase)
            && !word.MeaningVi.Contains(p.MeaningVi, StringComparison.OrdinalIgnoreCase);

        var tiers = new[]
        {
            pool.Where(p => Valid(p) && p.Pos == word.Pos && p.DeckId == word.DeckId),
            pool.Where(p => Valid(p) && p.Pos == word.Pos),
            pool.Where(Valid),
        };

        var options = new List<string> { answer };
        foreach (var tier in tiers)
        {
            foreach (var candidate in tier.OrderBy(_ => Random.Shared.Next()))
            {
                if (options.Count == OptionCount) break;
                if (seen.Add(label(candidate))) options.Add(label(candidate));
            }
            if (options.Count == OptionCount) break;
        }

        Shuffle(options);
        return options;
    }

    private static void Shuffle<T>(IList<T> list)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }
}
