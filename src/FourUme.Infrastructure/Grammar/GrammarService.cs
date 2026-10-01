using FourUme.Application.Abstractions;
using FourUme.Application.Grammar;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Grammar;

public class GrammarService(IAppDbContext db) : IGrammarService
{
    public async Task<IReadOnlyList<GrammarLessonSummaryDto>> GetLessonsAsync(Guid userId, CancellationToken ct = default)
    {
        var best = await db.GrammarAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .GroupBy(a => a.LessonSlug)
            .Select(g => new { Slug = g.Key, Best = g.Max(x => x.Score) })
            .ToDictionaryAsync(x => x.Slug, x => (int?)x.Best, ct);

        return GrammarCatalog.Lessons.Select(l => new GrammarLessonSummaryDto(
            l.Slug,
            l.TitleVi,
            l.Level,
            l.Exercises.Count,
            best.GetValueOrDefault(l.Slug))).ToList();
    }

    public Task<GrammarLessonDetailDto?> GetLessonAsync(string slug, CancellationToken ct = default)
    {
        var lesson = GrammarCatalog.Find(slug);
        if (lesson is null)
        {
            return Task.FromResult<GrammarLessonDetailDto?>(null);
        }

        var dto = new GrammarLessonDetailDto(
            lesson.Slug,
            lesson.TitleVi,
            lesson.Level,
            lesson.SummaryVi,
            lesson.Formula,
            lesson.Example,
            lesson.CommonMistakeVi,
            lesson.Exercises.Select(e => new GrammarExerciseDto(
                e.Id, e.Type, e.Prompt, e.Options, e.Explanation, e.Answer)).ToList());
        return Task.FromResult<GrammarLessonDetailDto?>(dto);
    }

    public async Task<GrammarSubmitResponse> SubmitAsync(Guid userId, string slug, GrammarSubmitRequest request, CancellationToken ct = default)
    {
        var lesson = GrammarCatalog.Find(slug)
            ?? throw new InvalidOperationException("Không tìm thấy bài ngữ pháp.");

        var answerMap = request.Answers.ToDictionary(a => a.ExerciseId, a => a.Answer.Trim(), StringComparer.OrdinalIgnoreCase);
        var results = new List<GrammarSubmitResultItem>();
        var score = 0;

        foreach (var exercise in lesson.Exercises)
        {
            answerMap.TryGetValue(exercise.Id, out var given);
            given ??= "";
            var correct = string.Equals(given.Trim(), exercise.Answer.Trim(), StringComparison.OrdinalIgnoreCase);
            if (correct) score++;
            results.Add(new GrammarSubmitResultItem(exercise.Id, correct, exercise.Answer, exercise.Explanation));
        }

        db.GrammarAttempts.Add(new GrammarAttempt
        {
            UserId = userId,
            LessonSlug = lesson.Slug,
            Score = score,
            Total = lesson.Exercises.Count
        });
        await db.SaveChangesAsync(ct);

        return new GrammarSubmitResponse(score, lesson.Exercises.Count, results);
    }
}
