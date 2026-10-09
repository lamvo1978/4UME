using System.Text.Json;
using FourUme.Application.Grammar;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Persistence;

/// <summary>
/// Loads data/grammar/*.json. A lesson is inserted when missing and overwritten only when the
/// file's version is higher than the stored one and the lesson was never edited in the admin.
/// </summary>
public static class GrammarSeeder
{
    public static async Task SeedAsync(AppDbContext db, string directory, ILogger logger, CancellationToken ct = default)
    {
        if (!Directory.Exists(directory))
        {
            logger.LogWarning("Grammar directory not found: {Dir}", directory);
            return;
        }

        var existing = await db.GrammarLessons.ToDictionaryAsync(l => l.Slug, ct);
        var inserted = 0;
        var updated = 0;

        foreach (var file in Directory.GetFiles(directory, "*.json").Order())
        {
            GrammarLessonDocument? doc;
            try
            {
                await using var stream = File.OpenRead(file);
                doc = await JsonSerializer.DeserializeAsync<GrammarLessonDocument>(stream, GrammarJson.Options, ct);
            }
            catch (JsonException ex)
            {
                logger.LogError("Skipping {File}: invalid JSON ({Message})", Path.GetFileName(file), ex.Message);
                continue;
            }

            var errors = doc is null ? ["file rỗng"] : GrammarValidator.Validate(doc);
            if (errors.Count > 0)
            {
                logger.LogError("Skipping {File}: {Errors}", Path.GetFileName(file), string.Join("; ", errors));
                continue;
            }

            if (existing.TryGetValue(doc!.Slug, out var lesson))
            {
                if (lesson.EditedAt is not null || lesson.Version >= doc.Version) continue;
                Apply(lesson, doc);
                updated++;
            }
            else
            {
                lesson = new GrammarLesson { Slug = doc.Slug };
                Apply(lesson, doc);
                db.GrammarLessons.Add(lesson);
                existing[doc.Slug] = lesson;
                inserted++;
            }
        }

        if (inserted + updated > 0) await db.SaveChangesAsync(ct);
        logger.LogInformation("Grammar lessons: {Inserted} inserted, {Updated} updated, {Total} total.",
            inserted, updated, existing.Count);
    }

    private static void Apply(GrammarLesson lesson, GrammarLessonDocument doc)
    {
        lesson.Version = doc.Version;
        lesson.TitleVi = doc.TitleVi;
        lesson.TitleEn = doc.TitleEn;
        lesson.Level = doc.Level;
        lesson.SortOrder = doc.Order;
        lesson.SummaryVi = doc.SummaryVi;
        lesson.QuizSize = doc.QuizSize ?? 8;
        lesson.Published = doc.Published ?? true;
        lesson.SectionsJson = JsonSerializer.Serialize(doc.Sections, GrammarJson.Options);
        lesson.ExercisesJson = JsonSerializer.Serialize(doc.Exercises, GrammarJson.Options);
        lesson.UpdatedAt = DateTimeOffset.UtcNow;
    }
}
