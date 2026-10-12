namespace FourUme.Application.Admin;

/// <param name="Unused">Codes not redeemed and not revoked.</param>
/// <param name="Students">Redeemed codes still active.</param>
public record AdminPartnerDto(
    Guid Id,
    string Name,
    IReadOnlyList<string> Features,
    string? Note,
    DateTimeOffset CreatedAt,
    int Codes,
    int Unused,
    int Students,
    int Revoked);

/// <param name="Code">Formatted for reading, e.g. "ABCD-EFGH".</param>
public record AdminPartnerCodeDto(
    Guid Id,
    string Code,
    string Batch,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UsedAt,
    Guid? UserId,
    string? UserEmail,
    string? UserName,
    DateTimeOffset? RevokedAt);

/// <param name="Codes">Newest first.</param>
public record AdminPartnerDetailDto(AdminPartnerDto Partner, IReadOnlyList<AdminPartnerCodeDto> Codes);

public record SavePartnerRequest(string? Name, IReadOnlyList<string>? Features, string? Note);

/// <param name="Batch">Label shown next to each code, e.g. the class name.</param>
public record GeneratePartnerCodesRequest(string? Batch, int Count);

public record SetRevokedRequest(bool Revoked);

public record PartnerSnapshot(string Name, string Features, string? Note);

public interface IAdminPartnerService
{
    Task<IReadOnlyList<AdminPartnerDto>> ListAsync(CancellationToken ct = default);
    Task<AdminPartnerDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<AdminPartnerDetailDto> CreateAsync(SavePartnerRequest request, CancellationToken ct = default);
    Task<AdminPartnerDetailDto> UpdateAsync(Guid id, SavePartnerRequest request, CancellationToken ct = default);
    Task<AdminPartnerDetailDto> GenerateCodesAsync(Guid id, GeneratePartnerCodesRequest request, CancellationToken ct = default);
    /// <summary>Revoking a redeemed code ends that student's partner Premium and features; restoring brings them back.</summary>
    Task<AdminPartnerCodeDto> SetCodeRevokedAsync(Guid codeId, bool revoked, CancellationToken ct = default);
}
