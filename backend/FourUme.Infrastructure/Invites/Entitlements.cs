using FourUme.Application.Abstractions;
using FourUme.Application.Invites;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Invites;

/// <summary>Premium and features from every source: the user's own end date and active partner codes.</summary>
public static class Entitlements
{
    public static async Task<AccessDto> GetAsync(IAppDbContext db, Guid userId, CancellationToken ct)
    {
        await PremiumHold.SyncAsync(db, userId, ct);
        var now = DateTimeOffset.UtcNow;
        var until = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.PremiumUntil).FirstOrDefaultAsync(ct);
        var codes = await db.PartnerCodes.AsNoTracking()
            .Where(c => c.UsedById == userId && c.RevokedAt == null && (c.ExpiresAt == null || c.ExpiresAt > now))
            .Select(c => new { c.Partner!.Name, c.Partner.Features, c.ExpiresAt, c.HeldPremium })
            .ToListAsync(ct);
        if (codes.Count == 0) return new AccessDto(until > now, until, null, []);

        var partnerName = string.Join(", ", codes.Select(p => p.Name).Distinct());
        var features = codes.SelectMany(p => FeatureKeys.Parse(p.Features)).Distinct().ToList();
        var partnerUntil = codes.Any(c => c.ExpiresAt is null) ? null : codes.Max(c => c.ExpiresAt);
        var held = codes.Aggregate(TimeSpan.Zero, (sum, c) => sum + (c.HeldPremium ?? TimeSpan.Zero));
        return new AccessDto(true, until, partnerName, features, partnerUntil, (int)Math.Ceiling(held.TotalDays));
    }
}

/// <summary>
/// Pauses the learner's own Premium while a partner code is active and gives the remaining time back afterwards.
/// Codes end by revoke or expiry without any job running, so every read of the learner's access settles first.
/// </summary>
public static class PremiumHold
{
    private sealed record CodeState(Guid Id, DateTimeOffset? UsedAt, DateTimeOffset? RevokedAt, DateTimeOffset? ExpiresAt, TimeSpan? HeldPremium);

    /// <param name="ActiveId">Active code that keeps the held time.</param>
    /// <param name="Hold">Time to add to the active code (own Premium left plus time held on ended codes).</param>
    /// <param name="NewUntil">Own Premium end to write; used when no code is active any more.</param>
    private sealed record Plan(Guid? ActiveId, TimeSpan Hold, bool ClearOwn, DateTimeOffset? NewUntil, List<Guid> Release);

    public static async Task SyncAsync(IAppDbContext db, Guid userId, CancellationToken ct)
    {
        if (await PlanAsync(db, userId, ct) is null) return;

        var database = ((DbContext)db).Database;
        await using var tx = database.CurrentTransaction is null ? await database.BeginTransactionAsync(ct) : null;
        await database.ExecuteSqlAsync($"""SELECT 1 FROM "Users" WHERE "Id" = {userId} FOR UPDATE""", ct);
        if (await PlanAsync(db, userId, ct) is not { } plan)
        {
            if (tx is not null) await tx.CommitAsync(ct);
            return;
        }

        if (plan.Release.Count > 0)
            await db.PartnerCodes.Where(c => plan.Release.Contains(c.Id)).ExecuteUpdateAsync(s => s.SetProperty(c => c.HeldPremium, (TimeSpan?)null), ct);
        if (plan.ActiveId is { } activeId)
        {
            var hold = plan.Hold;
            await db.PartnerCodes.Where(c => c.Id == activeId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.HeldPremium, c => (c.HeldPremium ?? TimeSpan.Zero) + hold), ct);
            if (plan.ClearOwn)
                await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s.SetProperty(u => u.PremiumUntil, (DateTimeOffset?)null), ct);
        }
        else
        {
            var until = plan.NewUntil;
            await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s.SetProperty(u => u.PremiumUntil, until), ct);
        }
        if (tx is not null) await tx.CommitAsync(ct);
    }

    private static async Task<Plan?> PlanAsync(IAppDbContext db, Guid userId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var codes = await db.PartnerCodes.AsNoTracking()
            .Where(c => c.UsedById == userId)
            .Select(c => new CodeState(c.Id, c.UsedAt, c.RevokedAt, c.ExpiresAt, c.HeldPremium))
            .ToListAsync(ct);
        if (codes.Count == 0) return null;
        var until = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.PremiumUntil).FirstOrDefaultAsync(ct);

        var active = codes.Where(c => IsActive(c, now)).OrderBy(c => c.UsedAt).FirstOrDefault();
        var ended = codes.Where(c => c.HeldPremium is not null && c.Id != active?.Id).ToList();
        var endedHeld = ended.Aggregate(TimeSpan.Zero, (sum, c) => sum + c.HeldPremium!.Value);

        if (active is not null)
        {
            var own = until > now ? until.Value - now : TimeSpan.Zero;
            if (own <= TimeSpan.Zero && ended.Count == 0) return null;
            return new Plan(active.Id, own + endedHeld, own > TimeSpan.Zero, null, ended.Select(c => c.Id).ToList());
        }
        if (ended.Count == 0) return null;

        // The paused time resumes from when the code ended, not from whenever the learner next opens the app.
        var end = ended.Max(c => EndOf(c, now));
        var from = until is { } u && u > end ? u : end;
        return new Plan(null, TimeSpan.Zero, false, from + endedHeld, ended.Select(c => c.Id).ToList());
    }

    private static bool IsActive(CodeState c, DateTimeOffset now) => c.RevokedAt is null && (c.ExpiresAt is null || c.ExpiresAt > now);

    private static DateTimeOffset EndOf(CodeState c, DateTimeOffset now)
    {
        var end = now;
        if (c.RevokedAt is { } r && r < end) end = r;
        if (c.ExpiresAt is { } e && e < end) end = e;
        return end;
    }
}
