using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Practice;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Activity;
using FourUme.Infrastructure.Invites;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Practice;

public class PracticeService(IAppDbContext db, IClientClock clock, IActivityService activity) : IPracticeService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<PracticeOverviewDto> GetOverviewAsync(Guid userId, CancellationToken ct = default)
    {
        var counts = await db.PracticeSentences.AsNoTracking()
            .Where(s => s.Published)
            .GroupBy(s => s.Level)
            .Select(g => new { Level = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Level, x => x.Count, ct);
        var levels = PracticeRules.Levels.Select(l => new PracticeLevelDto(l, counts.GetValueOrDefault(l))).ToList();
        return new PracticeOverviewDto(levels, await GetAccessAsync(userId, ct));
    }

    public async Task<IReadOnlyList<PracticeSentenceDto>?> GetRoundAsync(Guid userId, string level, int count, CancellationToken ct = default)
    {
        var access = await GetAccessAsync(userId, ct);
        if (access.State == PracticeAccessStates.Locked) return null;
        if (access.State == PracticeAccessStates.Trial)
        {
            var now = DateTimeOffset.UtcNow;
            var taken = await db.Users.Where(u => u.Id == userId && u.PracticeTrialAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.PracticeTrialAt, now), ct);
            if (taken == 0) return null;
        }

        level = (level ?? "").Trim().ToUpperInvariant();
        if (!PracticeRules.Levels.Contains(level)) return [];
        return await db.PracticeSentences.AsNoTracking()
            .Where(s => s.Published && s.Level == level)
            .OrderBy(_ => EF.Functions.Random())
            .Take(Math.Clamp(count, 1, PracticeRules.MaxRound))
            .Select(s => new PracticeSentenceDto(s.Id, s.Level, s.Topic, s.En, s.Vi, s.AudioText == s.En ? s.AudioUrl : null))
            .ToListAsync(ct);
    }

    public async Task RecordAsync(Guid userId, CancellationToken ct = default)
    {
        db.ListeningLogs.Add(new ListeningLog { UserId = userId, LocalDate = clock.Today, LessonSlug = PracticeRules.LogSlug, Kind = ListeningLogKind.Sentence });
        await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Listening, ct);
    }

    private async Task<PracticeAccessDto> GetAccessAsync(Guid userId, CancellationToken ct)
    {
        var config = await LoadConfigAsync(db, ct);
        var every = config.GiftEveryDays;
        int? daysToGift = null;
        var gift = false;
        if (every > 0)
        {
            var today = clock.Today;
            var dates = (await db.StudyDays.AsNoTracking().Where(d => d.UserId == userId).Select(d => d.Date).ToListAsync(ct)).ToHashSet();
            var untilYesterday = ActivityService.RunEndingOn(dates, today.AddDays(-1));
            gift = untilYesterday > 0 && untilYesterday % every == 0;
            var streak = ActivityService.CurrentStreak(dates, today);
            daysToGift = streak == 0 ? every : (every - streak % every) % every;
        }

        if ((await Entitlements.GetAsync(db, userId, ct)).Premium) return new PracticeAccessDto(PracticeAccessStates.Premium, every, daysToGift);
        if (gift) return new PracticeAccessDto(PracticeAccessStates.Gift, every, daysToGift);
        var trialFree = config.FreeTrial && await db.Users.AnyAsync(u => u.Id == userId && u.PracticeTrialAt == null, ct);
        return new PracticeAccessDto(trialFree ? PracticeAccessStates.Trial : PracticeAccessStates.Locked, every, daysToGift);
    }

    /// <summary>Also used by the admin service.</summary>
    internal static async Task<PracticeConfig> LoadConfigAsync(IAppDbContext db, CancellationToken ct)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == PracticeConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new PracticeConfig() : JsonSerializer.Deserialize<PracticeConfig>(stored, Json) ?? new PracticeConfig();
    }

    internal static string Serialize(PracticeConfig config) => JsonSerializer.Serialize(config, Json);
}
