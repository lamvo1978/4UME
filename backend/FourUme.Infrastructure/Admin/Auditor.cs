using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Domain.Entities;

namespace FourUme.Infrastructure.Admin;

/// <summary>Queues audit entries on the same DbContext so they are saved atomically with the change itself.</summary>
public sealed class Auditor(IAppDbContext db, ICurrentAdmin admin)
{
    public static JsonSerializerOptions Json => GrammarJson.Options;

    public void Record(string entityType, string entityId, string action, string summary, object? before, object? after)
    {
        var beforeJson = before is null ? null : JsonSerializer.Serialize(before, Json);
        var afterJson = after is null ? null : JsonSerializer.Serialize(after, Json);
        if (action == AuditActions.Update && beforeJson == afterJson) return;

        db.AuditLogs.Add(new AuditLog
        {
            UserId = admin.Id,
            UserName = admin.Name,
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            Summary = summary.Length > 300 ? summary[..300] : summary,
            Before = beforeJson,
            After = afterJson,
        });
    }

    public static WordSnapshot Snapshot(Word w) =>
        new(w.Id, w.DeckId, w.Text, w.Ipa, w.Pos, w.Level, w.MeaningVi, w.Example, w.ExampleVi, w.ImageUrl, w.Published);

    public static DeckSnapshot Snapshot(Deck d) => new(d.Id, d.TitleVi, d.Icon, d.Published);

    public static object Snapshot(MediaFile m) => new { m.Url, m.OriginalName, m.Width, m.Height, m.Bytes };
}
