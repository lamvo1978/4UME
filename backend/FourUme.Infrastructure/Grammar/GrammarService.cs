using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Grammar;
using FourUme.Application.Review;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Grammar;

public class GrammarService(IAppDbContext db, IActivityService activity) : IGrammarService
{
    /// <summary>First-try score needed for a lesson to enter the review schedule.</summary>
    private const double PassRatio = 0.7;

    public async Task<IReadOnlyList<GrammarLessonSummaryDto>> GetLessonsAsync(Guid userId, CancellationToken ct = default)
    {
        var lessons = await db.GrammarLessons.AsNoTracking()
            .Where(l => l.Published)
            .OrderBy(l => l.SortOrder)
            .Select(l => new { l.Slug, l.TitleVi, l.TitleEn, l.Level, l.SortOrder, l.QuizSize })
            .ToListAsync(ct);

        var attempts = await db.GrammarAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .Select(a => new { a.LessonSlug, a.Score, a.Total })
            .ToListAsync(ct);
        var best = attempts
            .GroupBy(a => a.LessonSlug)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(a => a.Total == 0 ? 0 : (double)a.Score / a.Total).First());

        var progress = await db.GrammarProgresses.AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.LessonSlug, ct);

        return lessons.Select(l =>
        {
            best.TryGetValue(l.Slug, out var b);
            progress.TryGetValue(l.Slug, out var p);
            return new GrammarLessonSummaryDto(l.Slug, l.TitleVi, l.TitleEn, l.Level, l.SortOrder, l.QuizSize,
                b?.Score, b?.Total, p?.ReviewLevel ?? 0, p?.NextReviewAt);
        }).ToList();
    }

    public async Task<GrammarLessonDetailDto?> GetLessonAsync(Guid userId, string slug, CancellationToken ct = default)
    {
        var lesson = await db.GrammarLessons.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Slug == slug && l.Published, ct);
        if (lesson is null) return null;

        var level = await db.GrammarProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && p.LessonSlug == slug)
            .Select(p => p.ReviewLevel)
            .FirstOrDefaultAsync(ct);

        return new GrammarLessonDetailDto(lesson.Slug, lesson.TitleVi, lesson.TitleEn, lesson.Level, lesson.SummaryVi,
            lesson.QuizSize, Parse(lesson.SectionsJson), Parse(lesson.ExercisesJson), level);
    }

    public async Task<GrammarCompleteResponse> CompleteAsync(Guid userId, string slug, GrammarCompleteRequest request, CancellationToken ct = default)
    {
        if (!await db.GrammarLessons.AnyAsync(l => l.Slug == slug, ct))
            throw new InvalidOperationException("Không tìm thấy bài ngữ pháp.");
        if (request.Total <= 0 || request.Score < 0 || request.Score > request.Total)
            throw new InvalidOperationException("Điểm không hợp lệ.");

        var now = DateTimeOffset.UtcNow;
        db.GrammarAttempts.Add(new GrammarAttempt { UserId = userId, LessonSlug = slug, Score = request.Score, Total = request.Total });

        var passed = (double)request.Score / request.Total >= PassRatio;
        var progress = await db.GrammarProgresses.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonSlug == slug, ct);
        var added = false;
        if (passed && progress is null)
        {
            progress = new GrammarProgress { UserId = userId, LessonSlug = slug };
            ReviewSchedule.Start(progress, now);
            db.GrammarProgresses.Add(progress);
            added = true;
        }

        await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Grammar, ct);
        return new GrammarCompleteResponse(request.Score, request.Total, passed, added, progress?.NextReviewAt);
    }

    public async Task<ReviewSummaryDto> GetReviewSummaryAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var inReview = db.GrammarProgresses.AsNoTracking().Where(p => p.UserId == userId && p.ReviewLevel > 0);

        var due = await inReview.CountAsync(p => p.NextReviewAt <= now, ct);
        var total = await inReview.CountAsync(ct);
        var mastered = await inReview.CountAsync(p => p.ReviewLevel >= ReviewSchedule.MasteredLevel, ct);
        var nextDue = await inReview.Where(p => p.NextReviewAt > now).MinAsync(p => p.NextReviewAt, ct);
        return new ReviewSummaryDto(due, total, mastered, nextDue);
    }

    public async Task<IReadOnlyList<GrammarReviewItemDto>> GetDueAsync(Guid userId, int limit, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var due = await (
            from p in db.GrammarProgresses.AsNoTracking()
            join l in db.GrammarLessons.AsNoTracking() on p.LessonSlug equals l.Slug
            where p.UserId == userId && p.ReviewLevel > 0 && p.NextReviewAt <= now && l.Published
            orderby p.NextReviewAt
            select new { l.Slug, l.TitleVi, p.ReviewLevel, l.ExercisesJson }
        ).Take(Math.Clamp(limit, 1, 20)).ToListAsync(ct);

        return due.Select(d => new GrammarReviewItemDto(d.Slug, d.TitleVi, d.ReviewLevel, Parse(d.ExercisesJson))).ToList();
    }

    public async Task<IReadOnlyList<GrammarReviewItemDto>> GetPracticeAsync(Guid userId, string? slug, int limit, CancellationToken ct = default)
    {
        var query =
            from p in db.GrammarProgresses.AsNoTracking()
            join l in db.GrammarLessons.AsNoTracking() on p.LessonSlug equals l.Slug
            where p.UserId == userId && p.ReviewLevel > 0 && l.Published
            select new { l.Slug, l.TitleVi, p.ReviewLevel, p.LapseCount, l.ExercisesJson };
        if (!string.IsNullOrWhiteSpace(slug)) query = query.Where(q => q.Slug == slug);

        var candidates = await query.ToListAsync(ct);
        return candidates
            .OrderBy(c => c.ReviewLevel <= ReviewSchedule.WeakLevel || c.LapseCount > 0 ? 0 : 1)
            .ThenBy(_ => Random.Shared.Next())
            .Take(Math.Clamp(limit, 1, 20))
            .Select(c => new GrammarReviewItemDto(c.Slug, c.TitleVi, c.ReviewLevel, Parse(c.ExercisesJson)))
            .ToList();
    }

    public async Task<GrammarReviewAnswerResponse> AnswerReviewAsync(Guid userId, GrammarReviewAnswerRequest request, CancellationToken ct = default)
    {
        var progress = await FindProgressAsync(userId, request.Slug, ct);
        var outcome = ReviewSchedule.ApplyAnswer(progress, request.Mistakes, DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Grammar, ct);
        return new GrammarReviewAnswerResponse(progress.LessonSlug, progress.ReviewLevel, progress.NextReviewAt,
            outcome == ReviewOutcome.Relearn, false);
    }

    public async Task<GrammarReviewAnswerResponse> AnswerPracticeAsync(Guid userId, GrammarReviewAnswerRequest request, CancellationToken ct = default)
    {
        var progress = await FindProgressAsync(userId, request.Slug, ct);
        var pulled = ReviewSchedule.ApplyPractice(progress, request.Mistakes, DateTimeOffset.UtcNow);
        if (pulled) await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Grammar, ct);
        return new GrammarReviewAnswerResponse(progress.LessonSlug, progress.ReviewLevel, progress.NextReviewAt, false, pulled);
    }

    private async Task<GrammarProgress> FindProgressAsync(Guid userId, string slug, CancellationToken ct)
    {
        var progress = await db.GrammarProgresses.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonSlug == slug, ct);
        if (progress is null || progress.ReviewLevel == 0)
            throw new InvalidOperationException("Bài này chưa nằm trong lịch ôn.");
        return progress;
    }

    private static JsonElement Parse(string json) => JsonSerializer.Deserialize<JsonElement>(json);
}
