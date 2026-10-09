using System.Text.Json;

namespace FourUme.Application.Admin;

/// <summary>The admin making the current request; used to sign audit entries.</summary>
public interface ICurrentAdmin
{
    Guid? Id { get; }
    string Name { get; }
}

/// <param name="EntityType">word, deck, grammar or media; empty = all.</param>
/// <param name="Q">Matches the entity id, its label or the admin's name.</param>
public record AuditQuery(string? EntityType, string? EntityId, string? Q, int Page = 1, int PageSize = 30);

/// <param name="Restorable">The entry carries a snapshot that can be written back.</param>
public record AuditEntryDto(
    Guid Id,
    DateTimeOffset At,
    string UserName,
    string EntityType,
    string EntityId,
    string Action,
    string Summary,
    bool Restorable);

/// <param name="Before">Snapshot before the change (null for creations).</param>
/// <param name="After">Snapshot after the change (null for deletions).</param>
public record AuditDetailDto(AuditEntryDto Entry, JsonElement? Before, JsonElement? After, bool Exists);

public record RestoreResultDto(string EntityType, string EntityId);

/// <summary>Word fields as stored in audit snapshots and accepted when restoring.</summary>
public record WordSnapshot(
    string Id,
    string DeckId,
    string Word,
    string Ipa,
    string Pos,
    string Level,
    string MeaningVi,
    string Example,
    string ExampleVi,
    string? ImageUrl,
    bool Published);

public record DeckSnapshot(string Id, string TitleVi, string Icon, bool Published);

public interface IAdminAuditService
{
    Task<PagedResult<AuditEntryDto>> GetEntriesAsync(AuditQuery query, CancellationToken ct = default);
    Task<AuditDetailDto?> GetEntryAsync(Guid id, CancellationToken ct = default);
    /// <summary>Writes the entry's snapshot back (recreating the entity if it was deleted).</summary>
    Task<RestoreResultDto> RestoreAsync(Guid id, CancellationToken ct = default);
}
