using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Invites;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace FourUme.Infrastructure.Invites;

public class ReferralService(AppDbContext db, ILogger<ReferralService> logger) : IReferralService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string WrongCode = "Mã không đúng. Bạn kiểm tra lại giúp mình nhé.";

    public Task<ReferralConfig> GetConfigAsync(CancellationToken ct = default) => LoadConfigAsync(db, ct);

    internal static async Task<ReferralConfig> LoadConfigAsync(IAppDbContext db, CancellationToken ct)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == ReferralConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new ReferralConfig() : JsonSerializer.Deserialize<ReferralConfig>(stored, Json) ?? new ReferralConfig();
    }

    public async Task<MyReferralDto> GetMineAsync(Guid userId, CancellationToken ct = default)
    {
        var config = await GetConfigAsync(ct);
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var code = await EnsureCodeAsync(userId, user.ReferralCode, ct);

        var invitees = await db.Referrals.AsNoTracking()
            .Where(r => r.InviterId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(100)
            .Select(r => new { r.InviteeId, r.Invitee!.DisplayName, r.Invitee.Avatar, r.CreatedAt, r.RewardedAt })
            .ToListAsync(ct);
        var progress = await ProgressAsync(invitees.Where(i => i.RewardedAt == null).Select(i => i.InviteeId).ToList(), ct);
        var earned = await db.Referrals.CountAsync(r => r.InviterId == userId && r.InviterRewarded, ct);
        var invitedBy = await db.Referrals.AsNoTracking()
            .Where(r => r.InviteeId == userId)
            .Select(r => new { r.Inviter!.DisplayName, r.RewardedAt })
            .FirstOrDefaultAsync(ct);
        var invitePaused = invitedBy is { RewardedAt: null } && (await ProgressAsync([userId], ct)).GetValueOrDefault(userId).Paused;

        return new MyReferralDto(
            config.Enabled,
            ReferralRules.FormatCode(code),
            ReferralRules.InviteUrl + code,
            config.RequiredStudyDays,
            config.RewardDays,
            config.MaxRewardsPerUser,
            earned,
            config.Enabled && invitedBy is null && InJoinWindow(user, config),
            invitedBy?.DisplayName,
            invitees.Select(i =>
            {
                var p = progress.GetValueOrDefault(i.InviteeId);
                var days = i.RewardedAt is null ? Math.Min(p.Days, config.RequiredStudyDays) : config.RequiredStudyDays;
                return new InviteeDto(i.DisplayName, i.CreatedAt, days, i.RewardedAt, i.RewardedAt is null && p.Paused, i.Avatar);
            }).ToList(),
            config.JoinWindowDays,
            invitePaused);
    }

    public async Task<RedeemResultDto> RedeemAsync(Guid userId, string? raw, CancellationToken ct = default)
    {
        var code = ReferralRules.Normalize(raw);
        if (code.Length is < 6 or > 16) throw new InvalidOperationException(WrongCode);

        var partnerCode = await db.PartnerCodes.AsNoTracking().Include(c => c.Partner).FirstOrDefaultAsync(c => c.Code == code, ct);
        if (partnerCode is not null) return await RedeemPartnerAsync(userId, partnerCode, ct);

        var inviter = await db.Users.AsNoTracking()
            .Where(u => u.ReferralCode == code)
            .Select(u => new { u.Id, u.DisplayName })
            .FirstOrDefaultAsync(ct);
        if (inviter is not null) return await RedeemReferralAsync(userId, inviter.Id, inviter.DisplayName, ct);

        throw new InvalidOperationException(WrongCode);
    }

    private async Task<RedeemResultDto> RedeemPartnerAsync(Guid userId, PartnerCode code, CancellationToken ct)
    {
        var partner = code.Partner!;
        var now = DateTimeOffset.UtcNow;
        var expired = code.ExpiresAt <= now;
        if (code.UsedById == userId && code.RevokedAt is null && !expired) throw new InvalidOperationException("Bạn đã dùng mã này rồi.");
        if (code.RevokedAt is not null) throw new InvalidOperationException("Mã này đã bị thu hồi. Bạn liên hệ trung tâm để được cấp mã mới nhé.");
        if (code.UsedAt is not null) throw new InvalidOperationException("Mã này đã có người sử dụng. Bạn liên hệ trung tâm để được cấp mã mới nhé.");
        if (expired) throw new InvalidOperationException("Mã này đã hết hạn. Bạn liên hệ trung tâm để được cấp mã mới nhé.");
        if (await db.PartnerCodes.AnyAsync(c => c.UsedById == userId && c.PartnerId == partner.Id && c.RevokedAt == null
                && (c.ExpiresAt == null || c.ExpiresAt > now), ct))
            throw new InvalidOperationException($"Bạn đã là học viên của {partner.Name} rồi, không cần nhập thêm mã.");

        // Conditional update so two people typing the same code at once can't both get it.
        var claimed = await db.PartnerCodes
            .Where(c => c.Id == code.Id && c.UsedAt == null && c.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedById, userId).SetProperty(c => c.UsedAt, now), ct);
        if (claimed == 0) throw new InvalidOperationException("Mã này đã có người sử dụng. Bạn liên hệ trung tâm để được cấp mã mới nhé.");

        var ownPremium = await db.Users.AnyAsync(u => u.Id == userId && u.PremiumUntil > now, ct);
        await PremiumHold.SyncAsync(db, userId, ct);
        logger.LogInformation("Partner code {CodeId} of {PartnerId} redeemed by {UserId}", code.Id, partner.Id, userId);
        var ielts = FeatureKeys.Parse(partner.Features).Contains(FeatureKeys.Ielts);
        var pendingInvite = await db.Referrals.AnyAsync(r => r.InviteeId == userId && r.RewardedAt == null, ct);
        return new RedeemResultDto("partner",
            $"Chào mừng học viên {partner.Name}! Tài khoản của bạn đã có Premium{(ielts ? " và mở phần IELTS" : "")}."
            + (ownPremium ? " Premium riêng của bạn được tạm dừng và sẽ tiếp tục khi hết thời gian học ở trung tâm." : "")
            + (pendingInvite ? " Ngày học cho mã mời bạn bè tạm dừng đếm và đếm tiếp sau thời gian học ở trung tâm." : ""));
    }

    private async Task<RedeemResultDto> RedeemReferralAsync(Guid userId, Guid inviterId, string inviterName, CancellationToken ct)
    {
        var config = await GetConfigAsync(ct);
        if (inviterId == userId) throw new InvalidOperationException("Đây là mã mời của chính bạn. Hãy gửi mã này cho bạn bè nhé!");
        if (!config.Enabled) throw new InvalidOperationException("Chương trình mời bạn đang tạm dừng.");
        if (await db.Referrals.AnyAsync(r => r.InviteeId == userId, ct)) throw new InvalidOperationException("Bạn đã nhập mã mời trước đó rồi.");
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        if (!InJoinWindow(user, config))
            throw new InvalidOperationException($"Mã mời chỉ dùng được trong {config.JoinWindowDays} ngày đầu sau khi tạo tài khoản.");
        if (await db.Referrals.AnyAsync(r => r.InviterId == userId && r.InviteeId == inviterId, ct))
            throw new InvalidOperationException("Bạn đã mời người này rồi nên không nhập được mã của họ.");

        db.Referrals.Add(new Referral { InviterId = inviterId, InviteeId = userId });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new InvalidOperationException("Bạn đã nhập mã mời trước đó rồi.");
        }

        // Someone who already studied enough days before typing the code is rewarded right away.
        await OnStudyDayAsync(userId, ct);
        var paused = (await ProgressAsync([userId], ct)).GetValueOrDefault(userId).Paused;
        return new RedeemResultDto("referral",
            $"Đã nhận mã mời của {inviterName}. Khi bạn học đủ {config.RequiredStudyDays} ngày, cả hai sẽ được {config.RewardDays} ngày Premium."
            + (paused ? " Ngày học được đếm sau khi hết thời gian học ở trung tâm." : ""));
    }

    public async Task OnStudyDayAsync(Guid userId, CancellationToken ct = default)
    {
        var referral = await db.Referrals.AsNoTracking().FirstOrDefaultAsync(r => r.InviteeId == userId && r.RewardedAt == null, ct);
        if (referral is null) return;
        var config = await GetConfigAsync(ct);
        if (!config.Enabled) return;
        var progress = (await ProgressAsync([userId], ct)).GetValueOrDefault(userId);
        if (progress.Paused || progress.Days < config.RequiredStudyDays) return;

        var now = DateTimeOffset.UtcNow;
        var claimed = await db.Referrals
            .Where(r => r.Id == referral.Id && r.RewardedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.RewardedAt, now), ct);
        if (claimed == 0) return;

        await ExtendPremiumAsync(userId, config.RewardDays, ct);
        var earned = await db.Referrals.CountAsync(r => r.InviterId == referral.InviterId && r.InviterRewarded, ct);
        if (earned < config.MaxRewardsPerUser)
        {
            await db.Referrals.Where(r => r.Id == referral.Id).ExecuteUpdateAsync(s => s.SetProperty(r => r.InviterRewarded, true), ct);
            await ExtendPremiumAsync(referral.InviterId, config.RewardDays, ct);
        }
        logger.LogInformation("Referral {ReferralId} rewarded (inviter rewarded: {InviterRewarded})", referral.Id, earned < config.MaxRewardsPerUser);
    }

    /// <summary>Adds days after the current end date, or from now when Premium has lapsed; paused while a partner code is active.</summary>
    private async Task ExtendPremiumAsync(Guid userId, int days, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        await db.Database.ExecuteSqlAsync($"""
            UPDATE "Users"
            SET "PremiumUntil" = GREATEST("PremiumUntil", {now}) + make_interval(days => {days})
            WHERE "Id" = {userId}
            """, ct);
        await PremiumHold.SyncAsync(db, userId, ct);
    }

    /// <summary>
    /// Study days that count toward an invite: not frozen and not while a partner code was active. An invite waiting for
    /// its reward is paused while the invitee is a partner student and resumes, keeping earlier days, once that ends.
    /// </summary>
    private async Task<Dictionary<Guid, (int Days, bool Paused)>> ProgressAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];
        var now = DateTimeOffset.UtcNow;
        var codes = await db.PartnerCodes.AsNoTracking()
            .Where(c => c.UsedById != null && userIds.Contains(c.UsedById.Value) && c.UsedAt != null)
            .Select(c => new { UserId = c.UsedById!.Value, UsedAt = c.UsedAt!.Value, c.RevokedAt, c.ExpiresAt })
            .ToListAsync(ct);
        var days = await db.StudyDays.AsNoTracking()
            .Where(d => userIds.Contains(d.UserId) && !d.Frozen)
            .Select(d => new { d.UserId, d.Date })
            .ToListAsync(ct);

        // Study days are calendar dates; partner periods are converted to Vietnam dates, end day counting again.
        static DateOnly VnDate(DateTimeOffset t) => DateOnly.FromDateTime(t.ToOffset(PartnerBilling.Offset).DateTime);
        var periods = codes.Select(c =>
        {
            DateTimeOffset? end = c.RevokedAt is { } r && (c.ExpiresAt is null || r < c.ExpiresAt) ? r : c.ExpiresAt;
            return new { c.UserId, From = VnDate(c.UsedAt), To = end is { } e ? VnDate(e) : DateOnly.MaxValue, Active = end is null || end > now };
        }).ToList();

        return userIds.ToDictionary(id => id, id =>
        {
            var mine = periods.Where(p => p.UserId == id).ToList();
            var counted = days.Count(d => d.UserId == id && !mine.Any(p => d.Date >= p.From && d.Date < p.To));
            return (counted, mine.Any(p => p.Active));
        });
    }

    private static bool InJoinWindow(User user, ReferralConfig config) =>
        user.CreatedAt > DateTimeOffset.UtcNow.AddDays(-config.JoinWindowDays);

    /// <summary>
    /// New accounts get their code at sign-up; this covers older accounts. Only an empty column is filled, so two first
    /// visits at once still end up with one code.
    /// </summary>
    private async Task<string> EnsureCodeAsync(Guid userId, string? current, CancellationToken ct)
    {
        if (current is not null) return current;
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var code = await InviteCodes.NewReferralCodeAsync(db, ct);
            try
            {
                await db.Users.Where(u => u.Id == userId && u.ReferralCode == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(u => u.ReferralCode, code), ct);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                continue;
            }
            if (await db.Users.Where(u => u.Id == userId).Select(u => u.ReferralCode).FirstAsync(ct) is { } saved) return saved;
        }
        throw new InvalidOperationException("Chưa tạo được mã mời, bạn thử lại sau nhé.");
    }
}
