using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Conversations;
using FourUme.Application.Invites;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Activity;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Conversations;

/// <summary>Daily session buckets for "Đàm thoại với AI" (first → streak gift → premium → add-on).</summary>
public sealed record ConversationQuotaSnapshot(
    int TurnAllowanceToday,
    int TurnsUsedToday,
    int SessionsAllowedToday,
    int SessionsUsedToday,
    int TurnsPerSession,
    string? NextSessionKind,
    string? BlockedReason,
    bool StreakGiftToday);

public static class ConversationQuota
{
    public static async Task<ConversationQuotaSnapshot> ComputeAsync(
        IAppDbContext db,
        IClientClock clock,
        Guid userId,
        ConversationConfig config,
        AccessDto access,
        CancellationToken ct)
    {
        var today = clock.Today;
        var premiumCore = access.Premium;
        var addonActive = premiumCore && access.ConversationAddon;

        var firstUsedEver = await db.Conversations.AsNoTracking()
            .AnyAsync(c => c.UserId == userId && (c.LearnerTurns > 0 || c.SessionKind == ConversationSessionKinds.First), ct);

        var streakGiftToday = await IsStreakGiftDayAsync(db, userId, config, today, ct);
        var todaySessions = await TodaySessionsAsync(db, clock, userId, today, ct);

        var firstUsedToday = todaySessions.Any(c => c.SessionKind == ConversationSessionKinds.First);
        var streakUsedToday = todaySessions.Any(c => c.SessionKind == ConversationSessionKinds.StreakGift);
        var premiumUsedToday = todaySessions.Count(c => c.SessionKind == ConversationSessionKinds.Premium);
        var addonUsedToday = todaySessions.Count(c => c.SessionKind == ConversationSessionKinds.Addon);

        var turnsUsedToday = await db.ConversationTurns.CountAsync(t => t.UserId == userId && t.LocalDate == today && t.FromLearner, ct);
        var addonTurnsToday = await AddonTurnsTodayAsync(db, userId, today, todaySessions, ct);

        var sessionsAllowedToday = 0;
        var turnAllowance = 0;

        if (!firstUsedEver)
        {
            sessionsAllowedToday++;
            turnAllowance += config.FreeFirstSessionTurns;
        }
        else if (streakGiftToday)
        {
            sessionsAllowedToday++;
            turnAllowance += config.StreakGiftSessionTurns;
        }

        if (premiumCore)
        {
            sessionsAllowedToday += config.PremiumSessionsPerDay;
            turnAllowance += config.PremiumSessionsPerDay * config.PremiumTurnsPerSession;
        }

        if (addonActive)
        {
            sessionsAllowedToday += config.AddonSessionsPerDay;
            turnAllowance += Math.Min(config.AddonSessionsPerDay * config.AddonTurnsPerSession, config.AddonDailyTurnCap);
        }

        var sessionsUsedToday = todaySessions.Count;
        var nextKind = PickNextSessionKind(config, premiumCore, addonActive, firstUsedEver, firstUsedToday, streakGiftToday, streakUsedToday,
            premiumUsedToday, addonUsedToday, addonTurnsToday);
        var turnsPerSession = nextKind is null ? 0 : TurnsForKind(config, nextKind);
        var blocked = nextKind is null
            ? premiumCore ? ConversationBlockedReasons.NoSessionsLeft : ConversationBlockedReasons.NeedPremium
            : null;

        return new ConversationQuotaSnapshot(
            turnAllowance,
            turnsUsedToday,
            sessionsAllowedToday,
            sessionsUsedToday,
            turnsPerSession,
            nextKind,
            blocked,
            streakGiftToday);
    }

    public static string? PickNextSessionKind(
        ConversationConfig config,
        bool premiumCore,
        bool addonActive,
        bool firstUsedEver,
        bool firstUsedToday,
        bool streakGiftToday,
        bool streakUsedToday,
        int premiumUsedToday,
        int addonUsedToday,
        int addonTurnsToday)
    {
        if (!firstUsedEver && !firstUsedToday) return ConversationSessionKinds.First;
        if (streakGiftToday && !streakUsedToday) return ConversationSessionKinds.StreakGift;
        if (premiumCore && premiumUsedToday < config.PremiumSessionsPerDay) return ConversationSessionKinds.Premium;
        if (addonActive && addonUsedToday < config.AddonSessionsPerDay && addonTurnsToday < config.AddonDailyTurnCap)
            return ConversationSessionKinds.Addon;
        return null;
    }

    public static int TurnsForKind(ConversationConfig config, string kind) => kind switch
    {
        ConversationSessionKinds.First => config.FreeFirstSessionTurns,
        ConversationSessionKinds.StreakGift => config.StreakGiftSessionTurns,
        ConversationSessionKinds.Premium => config.PremiumTurnsPerSession,
        ConversationSessionKinds.Addon => config.AddonTurnsPerSession,
        _ => config.MaxTurnsPerSession,
    };

    public static int SessionTurnLimit(ConversationConfig config, Conversation conversation)
    {
        var cap = conversation.SessionKind is { } k ? TurnsForKind(config, k) : config.MaxTurnsPerSession;
        return Math.Min(cap, config.MaxTurnsPerSession);
    }

    private static async Task<bool> IsStreakGiftDayAsync(IAppDbContext db, Guid userId, ConversationConfig config, DateOnly today, CancellationToken ct)
    {
        var every = config.StreakGiftEveryDays;
        if (every <= 0) return false;
        var dates = (await db.StudyDays.AsNoTracking().Where(d => d.UserId == userId).Select(d => d.Date).ToListAsync(ct)).ToHashSet();
        var untilYesterday = ActivityService.RunEndingOn(dates, today.AddDays(-1));
        return untilYesterday > 0 && untilYesterday % every == 0;
    }

    private static async Task<List<Conversation>> TodaySessionsAsync(IAppDbContext db, IClientClock clock, Guid userId, DateOnly today, CancellationToken ct)
    {
        var start = new DateTimeOffset(today, TimeOnly.MinValue, clock.Offset);
        var end = start.AddDays(1);
        return await db.Conversations.AsNoTracking()
            .Where(c => c.UserId == userId && c.StartedAt >= start && c.StartedAt < end)
            .ToListAsync(ct);
    }

    private static async Task<int> AddonTurnsTodayAsync(
        IAppDbContext db,
        Guid userId,
        DateOnly today,
        IReadOnlyList<Conversation> todaySessions,
        CancellationToken ct)
    {
        var addonIds = todaySessions.Where(c => c.SessionKind == ConversationSessionKinds.Addon).Select(c => c.Id).ToList();
        if (addonIds.Count == 0) return 0;
        return await db.ConversationTurns.CountAsync(t => addonIds.Contains(t.ConversationId) && t.LocalDate == today && t.FromLearner, ct);
    }
}
