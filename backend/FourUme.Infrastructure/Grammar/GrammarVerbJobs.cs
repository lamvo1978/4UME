using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Grammar;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Grammar;

/// <summary>
/// Tags the verbs of every question that has no tenses yet, one lesson at a time in the background.
/// Progress lives in memory only; lessons finished before a restart keep their tags.
/// </summary>
public sealed class GrammarVerbJobs(IServiceScopeFactory scopes, IHostApplicationLifetime lifetime, ILogger<GrammarVerbJobs> logger)
{
    public sealed class Job
    {
        public int Done { get; set; }
        public int Total { get; init; }
        public bool Running { get; set; } = true;
        public string? Error { get; set; }
    }

    private readonly object _lock = new();
    public Job? Current { get; private set; }

    public static int Untagged(string exercisesJson, string practiceJson) =>
        Parse(exercisesJson).Concat(Parse(practiceJson)).Count(e => e.Verbs is null);

    public static async Task<int> CountMissingAsync(IAppDbContext db, CancellationToken ct)
    {
        var rows = await db.GrammarLessons.AsNoTracking().Select(l => new { l.ExercisesJson, l.PracticeJson }).ToListAsync(ct);
        return rows.Sum(r => Untagged(r.ExercisesJson, r.PracticeJson));
    }

    public Job Start(IReadOnlyList<string> slugs)
    {
        lock (_lock)
        {
            if (Current is { Running: true }) throw new InvalidOperationException("Đang gắn thì động từ, đợi xong lượt này nhé.");
            var job = new Job { Total = slugs.Count };
            Current = job;
            _ = Task.Run(() => RunAsync(slugs, job, lifetime.ApplicationStopping));
            return job;
        }
    }

    private async Task RunAsync(IReadOnlyList<string> slugs, Job job, CancellationToken ct)
    {
        try
        {
            foreach (var slug in slugs)
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var tagger = scope.ServiceProvider.GetRequiredService<GrammarVerbTagger>();
                var lesson = await db.GrammarLessons.FirstOrDefaultAsync(l => l.Slug == slug, ct);
                if (lesson is not null)
                {
                    var exercises = Parse(lesson.ExercisesJson);
                    var practice = Parse(lesson.PracticeJson);
                    var missing = exercises.Concat(practice).Where(e => e.Verbs is null).ToList();
                    if (missing.Count > 0)
                    {
                        await tagger.TagAsync(missing, ct);
                        // Re-read so an admin save made while the AI was busy is not overwritten.
                        await db.Entry(lesson).ReloadAsync(ct);
                        lesson.ExercisesJson = Merge(lesson.ExercisesJson, missing);
                        lesson.PracticeJson = Merge(lesson.PracticeJson, missing);
                        lesson.UpdatedAt = DateTimeOffset.UtcNow;
                        await db.SaveChangesAsync(ct);
                    }
                }
                job.Done++;
            }
            logger.LogInformation("Grammar verbs: {Count} lessons", job.Done);
        }
        catch (Exception ex)
        {
            job.Error = ex is InvalidOperationException ? ex.Message : "Gắn thì động từ thất bại, xem log của API.";
            if (ex is not InvalidOperationException) logger.LogError(ex, "Grammar verb tagging failed");
        }
        finally
        {
            job.Running = false;
        }
    }

    /// <summary>Copies tags onto the stored questions that still have the same id and text.</summary>
    private static string Merge(string json, List<GrammarExercise> tagged)
    {
        var stored = Parse(json);
        foreach (var e in stored.Where(e => e.Verbs is null))
        {
            var match = tagged.FirstOrDefault(t => t.Id == e.Id && GrammarVerbTagger.AnsweredText(t) == GrammarVerbTagger.AnsweredText(e));
            if (match is not null) e.Verbs = match.Verbs;
        }
        return JsonSerializer.Serialize(stored, GrammarJson.Options);
    }

    private static List<GrammarExercise> Parse(string json) =>
        JsonSerializer.Deserialize<List<GrammarExercise>>(json, GrammarJson.Options) ?? [];
}
