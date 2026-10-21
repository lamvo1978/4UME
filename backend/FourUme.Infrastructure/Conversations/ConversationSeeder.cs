using System.Text.Json;
using FourUme.Application.Conversations;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Conversations;

/// <summary>
/// Loads data/conversation/scenarios.json the first time only (empty table); afterwards the admin owns the list,
/// so deleted scenarios stay deleted.
/// </summary>
public static class ConversationSeeder
{
    public static async Task SeedAsync(AppDbContext db, string file, ILogger logger, CancellationToken ct = default)
    {
        if (await db.ConversationScenarios.AnyAsync(ct)) return;
        if (!File.Exists(file))
        {
            logger.LogWarning("Conversation scenarios file not found: {File}", file);
            return;
        }

        List<SaveConversationScenarioRequest>? items;
        try
        {
            await using var stream = File.OpenRead(file);
            items = await JsonSerializer.DeserializeAsync<List<SaveConversationScenarioRequest>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), ct);
        }
        catch (JsonException ex)
        {
            logger.LogError("Skipping {File}: invalid JSON ({Message})", Path.GetFileName(file), ex.Message);
            return;
        }

        var order = 0;
        foreach (var item in items ?? [])
        {
            var clean = AdminConversationService.Normalize(item);
            var errors = ConversationRules.Validate(clean);
            if (errors.Count > 0)
            {
                logger.LogError("Skipping scenario {Title}: {Errors}", clean.TitleVi, string.Join("; ", errors));
                continue;
            }
            var s = new ConversationScenario { SortOrder = ++order };
            AdminConversationService.Assign(s, clean);
            db.ConversationScenarios.Add(s);
        }
        if (order > 0) await db.SaveChangesAsync(ct);
        logger.LogInformation("Conversation scenarios: {Inserted} inserted.", order);
    }
}
