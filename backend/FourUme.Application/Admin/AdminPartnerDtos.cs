namespace FourUme.Application.Admin;

/// <param name="Unused">Codes not redeemed, not revoked and not expired.</param>
/// <param name="Students">Redeemed codes still active.</param>
/// <param name="Ended">Codes revoked or past their expiry.</param>
/// <param name="MonthUnits">Billable months so far in the current month (see <see cref="PartnerBilling"/>).</param>
public record AdminPartnerDto(
    Guid Id,
    string Name,
    string Prefix,
    IReadOnlyList<string> Features,
    string? Note,
    DateTimeOffset CreatedAt,
    int Codes,
    int Unused,
    int Students,
    int Ended,
    decimal MonthUnits);

/// <param name="Code">Formatted for reading, e.g. "AB-482913".</param>
/// <param name="HeldDays">The student's own Premium days paused by this code.</param>
public record AdminPartnerCodeDto(
    Guid Id,
    string Code,
    string Batch,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? UsedAt,
    Guid? UserId,
    string? UserEmail,
    string? UserName,
    DateTimeOffset? RevokedAt,
    int HeldDays);

/// <param name="Codes">Newest first.</param>
public record AdminPartnerDetailDto(AdminPartnerDto Partner, IReadOnlyList<AdminPartnerCodeDto> Codes);

/// <param name="Prefix">Two letters starting every code; only changeable before any code exists.</param>
public record SavePartnerRequest(string? Name, string? Prefix, IReadOnlyList<string>? Features, string? Note);

/// <param name="Batch">Label shown next to each code, e.g. the class name.</param>
/// <param name="ExpiresAt">End of the course; null keeps the codes active until revoked.</param>
public record GeneratePartnerCodesRequest(string? Batch, int Count, DateTimeOffset? ExpiresAt = null);

public record SetBatchExpiryRequest(string? Batch, DateTimeOffset? ExpiresAt);

public record SetRevokedRequest(bool Revoked);

public record PartnerSnapshot(string Name, string Features, string? Note, string Prefix = "");

/// <param name="StartedAt">When the student entered the code.</param>
/// <param name="EndedAt">Revoke or expiry, whichever came first; null while still active.</param>
/// <param name="Units">Billable months in the period: 0.5 for each half of the month the code was active in.</param>
public record PartnerBillingRowDto(
    string Code,
    string Batch,
    Guid? UserId,
    string? UserEmail,
    string? UserName,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    decimal Units);

/// <param name="Month">"yyyy-MM" in Vietnam time.</param>
public record PartnerBillingDto(string Month, decimal Units, IReadOnlyList<PartnerBillingRowDto> Rows);

/// <summary>
/// Monthly fee rule: a code counts half a month for each half (days 1–15, 16–end, Vietnam time) in which it was active,
/// so starting on day 1–15 or ending on day 16 or later counts the whole month.
/// </summary>
public static class PartnerBilling
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    public static (DateTimeOffset Start, DateTimeOffset Mid, DateTimeOffset End) Halves(int year, int month)
    {
        var start = new DateTimeOffset(year, month, 1, 0, 0, 0, Offset);
        return (start, start.AddDays(15), start.AddMonths(1));
    }

    public static decimal Units(DateTimeOffset from, DateTimeOffset? to, int year, int month)
    {
        var (start, mid, end) = Halves(year, month);
        static bool Overlaps(DateTimeOffset from, DateTimeOffset? to, DateTimeOffset a, DateTimeOffset b) => from < b && (to is null || to > a);
        return (Overlaps(from, to, start, mid) ? 0.5m : 0) + (Overlaps(from, to, mid, end) ? 0.5m : 0);
    }

    public static bool TryParseMonth(string? value, out int year, out int month)
    {
        year = month = 0;
        var parts = (value ?? "").Split('-');
        return parts.Length == 2 && int.TryParse(parts[0], out year) && int.TryParse(parts[1], out month)
            && year is >= 2020 and <= 2100 && month is >= 1 and <= 12;
    }
}

public interface IAdminPartnerService
{
    Task<IReadOnlyList<AdminPartnerDto>> ListAsync(CancellationToken ct = default);
    Task<AdminPartnerDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<AdminPartnerDetailDto> CreateAsync(SavePartnerRequest request, CancellationToken ct = default);
    Task<AdminPartnerDetailDto> UpdateAsync(Guid id, SavePartnerRequest request, CancellationToken ct = default);
    Task<AdminPartnerDetailDto> GenerateCodesAsync(Guid id, GeneratePartnerCodesRequest request, CancellationToken ct = default);
    /// <summary>Moves the end date of every code in a batch; students whose code becomes active again are paused again.</summary>
    Task<AdminPartnerDetailDto> SetBatchExpiryAsync(Guid id, SetBatchExpiryRequest request, CancellationToken ct = default);
    /// <summary>Revoking a redeemed code ends that student's partner Premium and features; restoring brings them back.</summary>
    Task<AdminPartnerCodeDto> SetCodeRevokedAsync(Guid codeId, bool revoked, CancellationToken ct = default);
    /// <summary>Students active at any time in the month and what each one counts for.</summary>
    Task<PartnerBillingDto> BillingAsync(Guid id, string month, CancellationToken ct = default);
}
