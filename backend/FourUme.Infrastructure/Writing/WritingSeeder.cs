using System.Text.Json;
using FourUme.Application.Writing;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Writing;

/// <summary>
/// Loads data/writing/prompts.json the first time only (empty table); afterwards the admin owns the list,
/// so deleted prompts stay deleted.
/// </summary>
public static class WritingSeeder
{
    public static async Task SeedAsync(AppDbContext db, string file, ILogger logger, CancellationToken ct = default)
    {
        if (await db.WritingPrompts.AnyAsync(ct)) return;
        if (!File.Exists(file))
        {
            logger.LogWarning("Writing prompts file not found: {File}", file);
            return;
        }

        List<SaveWritingPromptRequest>? items;
        try
        {
            await using var stream = File.OpenRead(file);
            items = await JsonSerializer.DeserializeAsync<List<SaveWritingPromptRequest>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), ct);
        }
        catch (JsonException ex)
        {
            logger.LogError("Skipping {File}: invalid JSON ({Message})", Path.GetFileName(file), ex.Message);
            return;
        }

        var order = 0;
        foreach (var item in items ?? [])
        {
            var clean = AdminWritingService.Normalize(item);
            var errors = WritingRules.Validate(clean);
            if (errors.Count > 0)
            {
                logger.LogError("Skipping writing prompt {Title}: {Errors}", clean.TitleVi, string.Join("; ", errors));
                continue;
            }
            var p = new WritingPrompt { SortOrder = ++order };
            AdminWritingService.Assign(p, clean);
            db.WritingPrompts.Add(p);
        }
        if (order > 0) await db.SaveChangesAsync(ct);
        logger.LogInformation("Writing prompts: {Inserted} inserted.", order);
    }
}
