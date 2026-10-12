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
        var rows = await Project(db.Partners.AsNoTracking().OrderBy(p => p.Name), DateTimeOffset.UtcNow).ToListAsync(ct);
        var units = await MonthUnitsAsync(null, ct);
        return rows.Select(r => ToDto(r, units.GetValueOrDefault(r.Id))).ToList();
    }

    public async Task<AdminPartnerDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var row = await Project(db.Partners.AsNoTracking().Where(p => p.Id == id), DateTimeOffset.UtcNow).FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException();
        var units = await MonthUnitsAsync(id, ct);
        var codes = await db.PartnerCodes.AsNoTracking()
            .Where(c => c.PartnerId == id)
            .OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Code)
            .Select(c => new
            {
                c.Id, c.Code, c.Batch, c.CreatedAt, c.ExpiresAt, c.UsedAt, c.UsedById,
                Email = c.UsedBy == null ? null : c.UsedBy.Email,
                Name = c.UsedBy == null ? null : c.UsedBy.DisplayName,
                c.RevokedAt, c.HeldPremium,
            })
            .ToListAsync(ct);
        return new AdminPartnerDetailDto(ToDto(row, units.GetValueOrDefault(id)), codes.Select(c => new AdminPartnerCodeDto(
            c.Id, ReferralRules.FormatCode(c.Code), c.Batch, c.CreatedAt, c.ExpiresAt, c.UsedAt, c.UsedById, c.Email, c.Name,
            c.RevokedAt, HeldDays(c.HeldPremium))).ToList());
    }

    public async Task<AdminPartnerDetailDto> CreateAsync(SavePartnerRequest request, CancellationToken ct = default)
    {
        var partner = new Partner();
        await ApplyAsync(partner, request, hasCodes: false, ct);
        db.Partners.Add(partner);
        auditor.Record(AuditEntities.Partner, partner.Id.ToString(), AuditActions.Create, $"Thêm đối tác: {partner.Name}", null, Snapshot(partner));
        await db.SaveChangesAsync(ct);
        return await GetAsync(partner.Id, ct);
    }

    public async Task<AdminPartnerDetailDto> UpdateAsync(Guid id, SavePartnerRequest request, CancellationToken ct = default)
    {
        var partner = await db.Partners.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new KeyNotFoundException();
        var before = Snapshot(partner);
        await ApplyAsync(partner, request, await db.PartnerCodes.AnyAsync(c => c.PartnerId == id, ct), ct);
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
        var expiresAt = request.ExpiresAt?.ToUniversalTime();
        if (expiresAt <= DateTimeOffset.UtcNow) throw new InvalidOperationException("Ngày hết hạn phải ở tương lai.");
        // One batch has one end date, so adding codes to an existing batch must keep its date.
        var current = await db.PartnerCodes.Where(c => c.PartnerId == id && c.Batch == batch).Select(c => new { c.ExpiresAt }).FirstOrDefaultAsync(ct);
        if (current is not null && current.ExpiresAt != expiresAt)
            throw new InvalidOperationException($"Lô {batch} đang {ExpiryText(current.ExpiresAt)}. Chọn đúng hạn đó, hoặc đổi hạn cả lô trước.");

        var codes = new HashSet<string>();
        for (var round = 0; round < 20 && codes.Count < request.Count; round++)
        {
            var fresh = new HashSet<string>();
            while (fresh.Count < request.Count - codes.Count) fresh.Add(ReferralRules.NewPrefixedCode(partner.Prefix));
            fresh.ExceptWith(codes);
            fresh.ExceptWith(await InviteCodes.TakenAsync(db, fresh, ct));
            codes.UnionWith(fresh);
        }
        if (codes.Count < request.Count) throw new InvalidOperationException("Chưa tạo đủ mã, bạn thử lại nhé.");

        var now = DateTimeOffset.UtcNow;
        foreach (var code in codes)
            db.PartnerCodes.Add(new PartnerCode { PartnerId = id, Code = code, Batch = batch, CreatedAt = now, ExpiresAt = expiresAt });
        auditor.Record(AuditEntities.Partner, id.ToString(), AuditActions.Create,
            $"Tạo {codes.Count} mã cho {partner.Name} (lô {batch}, {ExpiryText(expiresAt)})", null, null);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<AdminPartnerDetailDto> SetBatchExpiryAsync(Guid id, SetBatchExpiryRequest request, CancellationToken ct = default)
    {
        var partner = await db.Partners.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new KeyNotFoundException();
        var batch = (request.Batch ?? "").Trim();
        var expiresAt = request.ExpiresAt?.ToUniversalTime();
        if (expiresAt <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Ngày hết hạn phải ở tương lai. Muốn dừng ngay thì thu hồi từng mã.");
        var codes = db.PartnerCodes.Where(c => c.PartnerId == id && c.Batch == batch);
        var users = await codes.Where(c => c.UsedById != null).Select(c => c.UsedById!.Value).ToListAsync(ct);
        if (await codes.ExecuteUpdateAsync(s => s.SetProperty(c => c.ExpiresAt, expiresAt), ct) == 0) throw new KeyNotFoundException();

        auditor.Record(AuditEntities.Partner, id.ToString(), AuditActions.Update, $"Đổi hạn lô {batch} của {partner.Name}: {ExpiryText(expiresAt)}", null, null);
        await db.SaveChangesAsync(ct);
        foreach (var user in users) await PremiumHold.SyncAsync(db, user, ct);
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
                $"{(revoked ? "Thu hồi" : "Khôi phục")} mã {ReferralRules.FormatCode(code.Code)}{who} ({code.Partner!.Name})", null, null);
            await db.SaveChangesAsync(ct);
            if (code.UsedById is { } userId) await PremiumHold.SyncAsync(db, userId, ct);
        }
        var held = await db.PartnerCodes.AsNoTracking().Where(c => c.Id == codeId).Select(c => c.HeldPremium).FirstAsync(ct);
        return new AdminPartnerCodeDto(code.Id, ReferralRules.FormatCode(code.Code), code.Batch, code.CreatedAt, code.ExpiresAt,
            code.UsedAt, code.UsedById, code.UsedBy?.Email, code.UsedBy?.DisplayName, code.RevokedAt, HeldDays(held));
    }

    public async Task<PartnerBillingDto> BillingAsync(Guid id, string month, CancellationToken ct = default)
    {
        if (!PartnerBilling.TryParseMonth(month, out var year, out var m)) throw new InvalidOperationException("Tháng không hợp lệ.");
        if (!await db.Partners.AnyAsync(p => p.Id == id, ct)) throw new KeyNotFoundException();
        var (start, _, end) = PartnerBilling.Halves(year, m);
        var codes = await UsedIn(db.PartnerCodes.Where(c => c.PartnerId == id), start, end)
            .Select(c => new
            {
                c.Code, c.Batch, c.UsedById, c.UsedAt, c.RevokedAt, c.ExpiresAt,
                Email = c.UsedBy == null ? null : c.UsedBy.Email,
                Name = c.UsedBy == null ? null : c.UsedBy.DisplayName,
            })
            .ToListAsync(ct);
        var rows = codes
            .Select(c =>
            {
                var ended = EndOf(c.RevokedAt, c.ExpiresAt);
                return new PartnerBillingRowDto(ReferralRules.FormatCode(c.Code), c.Batch, c.UsedById, c.Email, c.Name, c.UsedAt!.Value,
                    ended, PartnerBilling.Units(c.UsedAt.Value, ended, year, m));
            })
            .Where(r => r.Units > 0)
            .OrderBy(r => r.Batch).ThenBy(r => r.Code)
            .ToList();
        return new PartnerBillingDto($"{year:D4}-{m:D2}", rows.Sum(r => r.Units), rows);
    }

    private async Task<Dictionary<Guid, decimal>> MonthUnitsAsync(Guid? partnerId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow.ToOffset(PartnerBilling.Offset);
        var (start, _, end) = PartnerBilling.Halves(now.Year, now.Month);
        var source = partnerId is { } id ? db.PartnerCodes.Where(c => c.PartnerId == id) : db.PartnerCodes;
        var codes = await UsedIn(source, start, end).Select(c => new { c.PartnerId, c.UsedAt, c.RevokedAt, c.ExpiresAt }).ToListAsync(ct);
        return codes.GroupBy(c => c.PartnerId)
            .ToDictionary(g => g.Key, g => g.Sum(c => PartnerBilling.Units(c.UsedAt!.Value, EndOf(c.RevokedAt, c.ExpiresAt), now.Year, now.Month)));
    }

    /// <summary>Codes redeemed before the period ends and not ended before it starts.</summary>
    private static IQueryable<PartnerCode> UsedIn(IQueryable<PartnerCode> codes, DateTimeOffset start, DateTimeOffset end)
    {
        // Npgsql only writes UTC values to timestamptz.
        var from = start.ToUniversalTime();
        var to = end.ToUniversalTime();
        return codes.Where(c => c.UsedAt != null && c.UsedAt < to
            && (c.RevokedAt == null || c.RevokedAt > from)
            && (c.ExpiresAt == null || c.ExpiresAt > from));
    }

    private static DateTimeOffset? EndOf(DateTimeOffset? revokedAt, DateTimeOffset? expiresAt) =>
        revokedAt is { } r && (expiresAt is null || r < expiresAt) ? r : expiresAt;

    private static int HeldDays(TimeSpan? held) => held is { } h ? (int)Math.Ceiling(h.TotalDays) : 0;

    private static string ExpiryText(DateTimeOffset? expiresAt) =>
        expiresAt is { } e ? $"hết hạn {e.ToOffset(PartnerBilling.Offset):dd/MM/yyyy}" : "không thời hạn";

    private async Task ApplyAsync(Partner partner, SavePartnerRequest request, bool hasCodes, CancellationToken ct)
    {
        var name = (request.Name ?? "").Trim();
        if (name.Length is < 1 or > 80) throw new InvalidOperationException("Tên đối tác cần từ 1 đến 80 ký tự.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > 500 }) throw new InvalidOperationException("Ghi chú tối đa 500 ký tự.");
        var prefix = ReferralRules.NormalizePrefix(request.Prefix)
            ?? throw new InvalidOperationException("Tiền tố mã cần đúng 2 chữ cái A–Z, ví dụ AB.");
        if (prefix != partner.Prefix)
        {
            if (hasCodes) throw new InvalidOperationException("Đối tác đã có mã nên không đổi được tiền tố.");
            if (await db.Partners.AnyAsync(p => p.Prefix == prefix && p.Id != partner.Id, ct))
                throw new InvalidOperationException($"Tiền tố {prefix} đã thuộc đối tác khác.");
            if (ReferralRules.NormalizePrefix((await ReferralService.LoadConfigAsync(db, ct)).CodePrefix) == prefix)
                throw new InvalidOperationException($"Tiền tố {prefix} đang dùng cho mã mời bạn bè (Cài đặt → Mời bạn bè).");
        }
        partner.Name = name;
        partner.Prefix = prefix;
        partner.Features = FeatureKeys.Join(request.Features);
        partner.Note = note;
    }

    private static PartnerSnapshot Snapshot(Partner p) => new(p.Name, p.Features, p.Note, p.Prefix);

    private sealed record Row(Guid Id, string Name, string Prefix, string Features, string? Note, DateTimeOffset CreatedAt, int Codes, int Unused,
        int Students, int Ended);

    private static IQueryable<Row> Project(IQueryable<Partner> partners, DateTimeOffset now) => partners.Select(p => new Row(
        p.Id, p.Name, p.Prefix, p.Features, p.Note, p.CreatedAt,
        p.Codes.Count,
        p.Codes.Count(c => c.UsedAt == null && c.RevokedAt == null && (c.ExpiresAt == null || c.ExpiresAt > now)),
        p.Codes.Count(c => c.UsedById != null && c.RevokedAt == null && (c.ExpiresAt == null || c.ExpiresAt > now)),
        p.Codes.Count(c => c.RevokedAt != null || c.ExpiresAt <= now)));

    private static AdminPartnerDto ToDto(Row r, decimal monthUnits) =>
        new(r.Id, r.Name, r.Prefix, FeatureKeys.Parse(r.Features), r.Note, r.CreatedAt, r.Codes, r.Unused, r.Students, r.Ended, monthUnits);
}
