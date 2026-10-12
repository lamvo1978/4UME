using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Invites;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Admin;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Invites;

public class AdminPartnerService(IAppDbContext db, Auditor auditor) : IAdminPartnerService
{
    public async Task<IReadOnlyList<AdminPartnerDto>> ListAsync(CancellationToken ct = default)
    {
        var rows = await Project(db.Partners.AsNoTracking().OrderBy(p => p.Name)).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<AdminPartnerDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var row = await Project(db.Partners.AsNoTracking().Where(p => p.Id == id)).FirstOrDefaultAsync(ct) ?? throw new KeyNotFoundException();
        var codes = await db.PartnerCodes.AsNoTracking()
            .Where(c => c.PartnerId == id)
            .OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Code)
            .Select(c => new AdminPartnerCodeDto(c.Id, c.Code, c.Batch, c.CreatedAt, c.UsedAt, c.UsedById,
                c.UsedBy == null ? null : c.UsedBy.Email, c.UsedBy == null ? null : c.UsedBy.DisplayName, c.RevokedAt))
            .ToListAsync(ct);
        return new AdminPartnerDetailDto(ToDto(row), codes.Select(c => c with { Code = ReferralRules.FormatPartnerCode(c.Code) }).ToList());
    }

    public async Task<AdminPartnerDetailDto> CreateAsync(SavePartnerRequest request, CancellationToken ct = default)
    {
        var partner = new Partner();
        Apply(partner, request);
        db.Partners.Add(partner);
        auditor.Record(AuditEntities.Partner, partner.Id.ToString(), AuditActions.Create, $"Thêm đối tác: {partner.Name}", null, Snapshot(partner));
        await db.SaveChangesAsync(ct);
        return await GetAsync(partner.Id, ct);
    }

    public async Task<AdminPartnerDetailDto> UpdateAsync(Guid id, SavePartnerRequest request, CancellationToken ct = default)
    {
        var partner = await db.Partners.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new KeyNotFoundException();
        var before = Snapshot(partner);
        Apply(partner, request);
        auditor.Record(AuditEntities.Partner, partner.Id.ToString(), AuditActions.Update, $"Sửa đối tác: {partner.Name}", before, Snapshot(partner));
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<AdminPartnerDetailDto> GenerateCodesAsync(Guid id, GeneratePartnerCodesRequest request, CancellationToken ct = default)
    {
        var partner = await db.Partners.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new KeyNotFoundException();
        var batch = (request.Batch ?? "").Trim();
        if (batch.Length is < 1 or > 80) throw new InvalidOperationException("Tên lô mã cần từ 1 đến 80 ký tự.");
        if (request.Count is < 1 or > ReferralRules.MaxBatchSize)
            throw new InvalidOperationException($"Số mã mỗi lần tạo phải từ 1 đến {ReferralRules.MaxBatchSize}.");

        var codes = new HashSet<string>();
        while (codes.Count < request.Count) codes.Add(ReferralRules.NewCode(ReferralRules.PartnerCodeLength));
        // ~10^11 combinations make a clash unlikely, but drop any that already exist instead of failing the batch.
        var taken = await db.PartnerCodes.Where(c => codes.Contains(c.Code)).Select(c => c.Code).ToListAsync(ct);
        codes.ExceptWith(taken);

        var now = DateTimeOffset.UtcNow;
        foreach (var code in codes) db.PartnerCodes.Add(new PartnerCode { PartnerId = id, Code = code, Batch = batch, CreatedAt = now });
        auditor.Record(AuditEntities.Partner, id.ToString(), AuditActions.Create, $"Tạo {codes.Count} mã cho {partner.Name} (lô {batch})", null, null);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<AdminPartnerCodeDto> SetCodeRevokedAsync(Guid codeId, bool revoked, CancellationToken ct = default)
    {
        var code = await db.PartnerCodes.Include(c => c.Partner).Include(c => c.UsedBy).FirstOrDefaultAsync(c => c.Id == codeId, ct)
            ?? throw new KeyNotFoundException();
        if ((code.RevokedAt is not null) != revoked)
        {
            code.RevokedAt = revoked ? DateTimeOffset.UtcNow : null;
            var who = code.UsedBy is null ? "" : $" của {code.UsedBy.Email}";
            auditor.Record(AuditEntities.Partner, code.PartnerId.ToString(), AuditActions.Update,
                $"{(revoked ? "Thu hồi" : "Khôi phục")} mã {ReferralRules.FormatPartnerCode(code.Code)}{who} ({code.Partner!.Name})", null, null);
            await db.SaveChangesAsync(ct);
        }
        return new AdminPartnerCodeDto(code.Id, ReferralRules.FormatPartnerCode(code.Code), code.Batch, code.CreatedAt, code.UsedAt,
            code.UsedById, code.UsedBy?.Email, code.UsedBy?.DisplayName, code.RevokedAt);
    }

    private static void Apply(Partner partner, SavePartnerRequest request)
    {
        var name = (request.Name ?? "").Trim();
        if (name.Length is < 1 or > 80) throw new InvalidOperationException("Tên đối tác cần từ 1 đến 80 ký tự.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > 500 }) throw new InvalidOperationException("Ghi chú tối đa 500 ký tự.");
        partner.Name = name;
        partner.Features = FeatureKeys.Join(request.Features);
        partner.Note = note;
    }

    private static PartnerSnapshot Snapshot(Partner p) => new(p.Name, p.Features, p.Note);

    private sealed record Row(Guid Id, string Name, string Features, string? Note, DateTimeOffset CreatedAt, int Codes, int Unused, int Students, int Revoked);

    private static IQueryable<Row> Project(IQueryable<Partner> partners) => partners.Select(p => new Row(
        p.Id, p.Name, p.Features, p.Note, p.CreatedAt,
        p.Codes.Count,
        p.Codes.Count(c => c.UsedAt == null && c.RevokedAt == null),
        p.Codes.Count(c => c.UsedById != null && c.RevokedAt == null),
        p.Codes.Count(c => c.RevokedAt != null)));

    private static AdminPartnerDto ToDto(Row r) =>
        new(r.Id, r.Name, FeatureKeys.Parse(r.Features), r.Note, r.CreatedAt, r.Codes, r.Unused, r.Students, r.Revoked);
}
