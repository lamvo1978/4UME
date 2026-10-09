using System.Text.Json;
using FourUme.Application.Grammar;
using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Persistence;

/// <summary>
/// Loads data/listening/*.json like <see cref="GrammarSeeder"/>: inserted when missing, overwritten only when the
/// file's version is higher and the piece was never edited in the admin. Audio is generated later in the admin.
/// </summary>
public static class ListeningSeeder
{
    public static async Task SeedAsync(AppDbContext db, string directory, ILogger logger, CancellationToken ct = default)
    {
        if (!Directory.Exists(directory))
        {
            logger.LogWarning("Listening directory not found: {Dir}", directory);
            return;
        }

        var existing = await db.ListeningLessons.ToDictionaryAsync(l => l.Slug, ct);
        var inserted = 0;
        var updated = 0;

        foreach (var file in Directory.GetFiles(directory, "*.json").Order())
        {
            ListeningLessonDocument? doc;
            try
            {
                await using var stream = File.OpenRead(file);
                doc = await JsonSerializer.DeserializeAsync<ListeningLessonDocument>(stream, GrammarJson.Options, ct);
            }
            catch (JsonException ex)
            {
                logger.LogError("Skipping {File}: invalid JSON ({Message})", Path.GetFileName(file), ex.Message);
                continue;
            }

            if (doc is not null) doc = ListeningRules.Normalize(doc);
            var errors = doc is null ? ["file rỗng"] : ListeningRules.Validate(doc);
            if (errors.Count > 0)
            {
                logger.LogError("Skipping {File}: {Errors}", Path.GetFileName(file), string.Join("; ", errors));
                continue;
            }

            if (existing.TryGetValue(doc!.Slug, out var lesson))
            {
                if (lesson.EditedAt is not null || lesson.Version >= doc.Version) continue;
                ListeningRules.Apply(doc, lesson);
                updated++;
            }
            else
            {
                lesson = new ListeningLesson { Slug = doc.Slug };
                ListeningRules.Apply(doc, lesson);
                db.ListeningLessons.Add(lesson);
                existing[doc.Slug] = lesson;
                inserted++;
            }
        }

        if (inserted + updated > 0) await db.SaveChangesAsync(ct);
        logger.LogInformation("Listening pieces: {Inserted} inserted, {Updated} updated, {Total} total.",
            inserted, updated, existing.Count);
    }
}
