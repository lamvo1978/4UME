using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminAuditService(
    IAppDbContext db,
    IAdminContentService content,
    IAdminGrammarService grammar,
    IAdminListeningService listening,
    IAdminSettingsService settings) : IAdminAuditService
{
    /// <summary>User role / lock changes are deliberately not restorable: they are redone from the user page.</summary>
    private static readonly string[] RestorableTypes = [AuditEntities.Word, AuditEntities.Deck, AuditEntities.Grammar, AuditEntities.Listening, AuditEntities.Settings];

    public async Task<PagedResult<AuditEntryDto>> GetEntriesAsync(AuditQuery query, CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.PageSize, 1, 100);
        var logs = db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.EntityType)) logs = logs.Where(l => l.EntityType == query.EntityType);
        if (!string.IsNullOrWhiteSpace(query.EntityId)) logs = logs.Where(l => l.EntityId == query.EntityId);
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var q = $"%{query.Q.Trim()}%";
            logs = logs.Where(l => EF.Functions.ILike(l.EntityId, q) || EF.Functions.ILike(l.Summary, q) || EF.Functions.ILike(l.UserName, q));
        }

        var total = await logs.CountAsync(ct);
        var items = await logs.OrderByDescending(l => l.At).Skip((page - 1) * size).Take(size)
            .Select(l => new { l.Id, l.At, l.UserName, l.EntityType, l.EntityId, l.Action, l.Summary, HasSnapshot = l.After != null || l.Before != null })
            .ToListAsync(ct);
        return new PagedResult<AuditEntryDto>(
            items.Select(l => new AuditEntryDto(l.Id, l.At, l.UserName, l.EntityType, l.EntityId, l.Action, l.Summary,
                l.HasSnapshot && IsRestorable(l.EntityType, l.Action))).ToList(),
            total, page, size);
    }

    public async Task<AuditDetailDto?> GetEntryAsync(Guid id, CancellationToken ct = default)
    {
        var log = await db.AuditLogs.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (log is null) return null;
        return new AuditDetailDto(ToDto(log), Parse(log.Before), Parse(log.After), await ExistsAsync(log.EntityType, log.EntityId, ct));
    }

    /// <summary>
    /// Restores the state the entry describes: the "after" snapshot, or the "before" one for deletions,
    /// so restoring a delete brings the item back.
    /// </summary>
    public async Task<RestoreResultDto> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var log = await db.AuditLogs.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct) ?? throw new KeyNotFoundException();
        var json = log.After ?? log.Before;
        if (json is null || !IsRestorable(log.EntityType, log.Action))
            throw new InvalidOperationException("Mục này không khôi phục được.");

        switch (log.EntityType)
        {
            case AuditEntities.Word:
                await content.RestoreWordAsync(Read<WordSnapshot>(json), ct);
                break;
            case AuditEntities.Deck:
                await content.RestoreDeckAsync(Read<DeckSnapshot>(json), ct);
                break;
            case AuditEntities.Grammar:
                await grammar.RestoreLessonAsync(Read<GrammarLessonDocument>(json), ct);
                break;
            case AuditEntities.Listening:
                await listening.RestoreLessonAsync(Read<ListeningLessonDocument>(json), ct);
                break;
            case AuditEntities.Settings when log.EntityId == NotificationConfig.SettingKey:
                await settings.RestoreNotificationsAsync(Read<NotificationConfig>(json), ct);
                break;
            case AuditEntities.Settings when log.EntityId == ListeningConfig.SettingKey:
                await settings.RestoreListeningAsync(Read<ListeningConfig>(json), ct);
                break;
            default:
                throw new InvalidOperationException("Mục này không khôi phục được.");
        }
        return new RestoreResultDto(log.EntityType, log.EntityId);
    }

    private static bool IsRestorable(string type, string action) => RestorableTypes.Contains(type) && action != AuditActions.Reorder;

    internal static AuditEntryDto ToDto(AuditLog l) => new(l.Id, l.At, l.UserName, l.EntityType, l.EntityId, l.Action, l.Summary,
        (l.After ?? l.Before) is not null && IsRestorable(l.EntityType, l.Action));

    private static JsonElement? Parse(string? json) => json is null ? null : JsonDocument.Parse(json).RootElement.Clone();

    private static T Read<T>(string json) =>
        JsonSerializer.Deserialize<T>(json, Auditor.Json) ?? throw new InvalidOperationException("Bản lưu bị hỏng.");

    private async Task<bool> ExistsAsync(string type, string id, CancellationToken ct) => type switch
    {
        AuditEntities.Word => await db.Words.AnyAsync(w => w.Id == id, ct),
        AuditEntities.Deck => await db.Decks.AnyAsync(d => d.Id == id, ct),
        AuditEntities.Grammar => await db.GrammarLessons.AnyAsync(l => l.Slug == id, ct),
        AuditEntities.Listening => await db.ListeningLessons.AnyAsync(l => l.Slug == id, ct),
        AuditEntities.Media => Guid.TryParse(id, out var g) && await db.MediaFiles.AnyAsync(m => m.Id == g, ct),
        AuditEntities.User => Guid.TryParse(id, out var u) && await db.Users.AnyAsync(x => x.Id == u, ct),
        AuditEntities.Settings => true,
        _ => false,
    };
}
