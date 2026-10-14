using FourUme.Application.Activity;
using FourUme.Application.Invites;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Activity;

public class ActivityService(AppDbContext db, IClientClock clock, IReferralService referrals, ILogger<ActivityService> logger) : IActivityService
{
    private static readonly string[] CefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];

    public async Task RecordAsync(Guid userId, ActivityKind kind, CancellationToken ct = default)
    {
        try
        {
            var today = clock.Today;
            await ApplyFreezesAsync(userId, today, ct);

            var (newWords, reviews, grammar, listens) = kind switch
            {
                ActivityKind.NewWord => (1, 0, 0, 0),
                ActivityKind.Review => (0, 1, 0, 0),
                ActivityKind.Grammar => (0, 0, 1, 0),
                ActivityKind.Listening => (0, 0, 0, 1),
                _ => (0, 0, 0, 0),
            };

            // Upsert keeps concurrent answers from racing on the unique (UserId, Date) index;
            // xmax = 0 is true only for the request that inserted the row (first activity today).
            var inserted = await db.Database.SqlQuery<bool>($"""
                INSERT INTO "StudyDays" ("Id", "UserId", "Date", "NewWords", "Reviews", "GrammarItems", "Listens", "Frozen", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {userId}, {today}, {newWords}, {reviews}, {grammar}, {listens}, FALSE, {DateTimeOffset.UtcNow})
                ON CONFLICT ("UserId", "Date") DO UPDATE SET
                    "NewWords" = "StudyDays"."NewWords" + EXCLUDED."NewWords",
                    "Reviews" = "StudyDays"."Reviews" + EXCLUDED."Reviews",
                    "GrammarItems" = "StudyDays"."GrammarItems" + EXCLUDED."GrammarItems",
                    "Listens" = "StudyDays"."Listens" + EXCLUDED."Listens",
                    "Frozen" = FALSE,
                    "UpdatedAt" = EXCLUDED."UpdatedAt"
                RETURNING (xmax = 0) AS "Value"
                """).ToListAsync(ct);

            if (inserted.FirstOrDefault())
            {
                var current = CurrentStreak(await LoadDatesAsync(userId, ct), today);
                var earned = current % StreakRules.FreezeEvery == 0 ? 1 : 0;
                await db.Database.ExecuteSqlAsync($"""
                    UPDATE "Users"
                    SET "BestStreak" = GREATEST("BestStreak", {current}),
                        "StreakFreezes" = LEAST({StreakRules.MaxFreezes}, "StreakFreezes" + {earned})
                    WHERE "Id" = {userId}
                    """, ct);
                await referrals.OnStudyDayAsync(userId, ct);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not record study activity for {UserId}", userId);
        }
    }

    public async Task<StreakDto> GetStreakAsync(Guid userId, CancellationToken ct = default)
    {
        var today = clock.Today;
        await ApplyFreezesAsync(userId, today, ct);

        var user = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.DailyGoal, u.StreakFreezes, u.BestStreak })
            .FirstAsync(ct);

        var from = today.AddDays(-(StreakRules.HistoryDays - 1));
        var days = await db.StudyDays.AsNoTracking()
            .Where(d => d.UserId == userId && d.Date >= from)
            .OrderBy(d => d.Date)
            .Select(d => new StudyDayDto(d.Date, d.NewWords, d.Reviews, d.GrammarItems, d.Frozen, d.Listens))
            .ToListAsync(ct);

        var dates = await LoadDatesAsync(userId, ct);
        var current = CurrentStreak(dates, today);
        var todayRow = days.FirstOrDefault(d => d.Date == today);
        var lastStudy = await db.StudyDays.AsNoTracking()
            .Where(d => d.UserId == userId && !d.Frozen)
            .MaxAsync(d => (DateOnly?)d.Date, ct);

        return new StreakDto(
            current,
            Math.Max(user.BestStreak, LongestRun(dates)),
            user.StreakFreezes,
            StreakRules.MaxFreezes,
            todayRow is { Frozen: false },
            todayRow?.NewWords ?? 0,
            todayRow?.Reviews ?? 0,
            todayRow?.GrammarItems ?? 0,
            user.DailyGoal,
            StreakRules.NextMilestone(current),
            today,
            lastStudy,
            days);
    }

    public async Task<StatsDto> GetStatsAsync(Guid userId, CancellationToken ct = default)
    {
        var streak = await GetStreakAsync(userId, ct);
        var memberSince = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.CreatedAt).FirstAsync(ct);
        var totalDays = await db.StudyDays.CountAsync(d => d.UserId == userId && !d.Frozen, ct);

        var wordLevels = await db.WordProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0 && !p.FromPlacement)
            .GroupBy(p => p.ReviewLevel)
            .Select(g => new { Level = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var hardWords = await db.WordProgresses.CountAsync(p => p.UserId == userId && p.Status == WordStatus.Hard, ct);
        var wordTotals = await db.Words.AsNoTracking()
            .GroupBy(w => w.Level)
            .Select(g => new { Level = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var wordDone = await (
            from p in db.WordProgresses.AsNoTracking()
            join w in db.Words.AsNoTracking() on p.WordId equals w.Id
            where p.UserId == userId && p.Status == WordStatus.Known
            group p by w.Level into g
            select new { Level = g.Key, Count = g.Count() }
        ).ToListAsync(ct);

        var grammarLevels = await db.GrammarProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && p.ReviewLevel > 0)
            .GroupBy(p => p.ReviewLevel)
            .Select(g => new { Level = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var attempted = await db.GrammarAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .Select(a => a.LessonSlug)
            .Distinct()
            .ToListAsync(ct);
        var passedSlugs = await db.GrammarProgresses.AsNoTracking()
            .Where(p => p.UserId == userId && p.ReviewLevel > 0)
            .Select(p => p.LessonSlug)
            .ToListAsync(ct);
        var lessons = await db.GrammarLessons.AsNoTracking()
            .Where(l => l.Published)
            .Select(l => new { l.Slug, l.Level })
            .ToListAsync(ct);

        var vocabulary = new MemoryDto(
            ToLevelArray(wordLevels.Select(x => (x.Level, x.Count))),
            hardWords,
            ByCefr(wordTotals.Select(x => (x.Level, x.Count)), wordDone.Select(x => (x.Level, x.Count))));

        var passed = passedSlugs.ToHashSet();
        var grammar = new MemoryDto(
            ToLevelArray(grammarLevels.Select(x => (x.Level, x.Count))),
            attempted.Count(s => !passed.Contains(s)),
            ByCefr(
                lessons.GroupBy(l => l.Level).Select(g => (g.Key, g.Count())),
                lessons.Where(l => passed.Contains(l.Slug)).GroupBy(l => l.Level).Select(g => (g.Key, g.Count()))));

        return new StatsDto(streak, vocabulary, grammar, totalDays, memberSince);
    }

    public async Task<WeeklyDto> GetWeeklyAsync(Guid userId, int weeks, CancellationToken ct = default)
    {
        var today = clock.Today;
        await ApplyFreezesAsync(userId, today, ct);

        var createdAt = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.CreatedAt).FirstAsync(ct);
        var joined = DateOnly.FromDateTime(createdAt.ToOffset(clock.Offset).DateTime);
        var current = WeeklyRules.WeekStart(today);
        var oldest = current.AddDays(-7 * (Math.Clamp(weeks, 1, WeeklyRules.MaxWeeks) - 1));
        if (oldest < WeeklyRules.WeekStart(joined)) oldest = WeeklyRules.WeekStart(joined);
        var last = current.AddDays(6);

        var rows = await db.StudyDays.AsNoTracking()
            .Where(d => d.UserId == userId && d.Date >= oldest && d.Date <= last)
            .ToDictionaryAsync(d => d.Date, ct);
        var good = await db.PronunciationAttempts.AsNoTracking()
            .Where(a => a.UserId == userId && a.LocalDate >= oldest && a.LocalDate <= last && a.Score >= WeeklyRules.GoodPronunciationScore)
            .Select(a => new { a.LocalDate, a.WordId })
            .ToListAsync(ct);
        var listening = (await db.ListeningLogs.AsNoTracking()
                .Where(l => l.UserId == userId && l.LocalDate >= oldest && l.LocalDate <= last)
                .GroupBy(l => new { l.LocalDate, l.Kind })
                .Select(g => new { g.Key.LocalDate, g.Key.Kind, Count = g.Count() })
                .ToListAsync(ct))
            .ToDictionary(x => (x.LocalDate, x.Kind), x => x.Count);
        var dates = await LoadDatesAsync(userId, ct);
        var countsTowardStreak = (await ListeningService.LoadConfigAsync(db, ct)).CountsTowardStreak;

        var result = new List<WeekSummaryDto>();
        for (var start = current; start >= oldest; start = start.AddDays(-7))
        {
            var end = start.AddDays(6);
            var days = Enumerable.Range(0, 7).Select(i =>
            {
                var date = start.AddDays(i);
                var row = rows.GetValueOrDefault(date);
                return new WeekDayDto(date, row?.NewWords ?? 0, row?.Reviews ?? 0, row?.GrammarItems ?? 0,
                    listening.GetValueOrDefault((date, ListeningLogKind.Listen)),
                    listening.GetValueOrDefault((date, ListeningLogKind.Dictation)) + listening.GetValueOrDefault((date, ListeningLogKind.Sentence)),
                    row is { Frozen: false }, row?.Frozen ?? false);
            }).ToList();
            var goodWords = good.Where(g => g.LocalDate >= start && g.LocalDate <= end).Select(g => g.WordId).Distinct().Count();
            var streak = end >= today ? CurrentStreak(dates, today) : RunEndingOn(dates, end);
            result.Add(new WeekSummaryDto(start, end, end >= today, days.Count(d => d.Studied),
                days.Sum(d => d.NewWords), days.Sum(d => d.Reviews), days.Sum(d => d.GrammarItems), days.Sum(d => d.Listens),
                days.Sum(d => d.DictationLines), goodWords, streak, days));
        }
        return new WeeklyDto(today, countsTowardStreak, result);
    }

    private static int RunEndingOn(HashSet<DateOnly> dates, DateOnly day)
    {
        var count = 0;
        while (dates.Contains(day))
        {
            count++;
            day = day.AddDays(-1);
        }
        return count;
    }

    /// <summary>Spends freezes to cover missed days right before today, if there are enough of them.</summary>
    private async Task ApplyFreezesAsync(Guid userId, DateOnly today, CancellationToken ct)
    {
        var last = await db.StudyDays
            .Where(d => d.UserId == userId && d.Date < today)
            .MaxAsync(d => (DateOnly?)d.Date, ct);
        if (last is null) return;

        var gap = today.DayNumber - last.Value.DayNumber - 1;
        if (gap < 1 || gap > StreakRules.MaxFreezes) return;

        var spent = await db.Database.ExecuteSqlAsync($"""
            UPDATE "Users" SET "StreakFreezes" = "StreakFreezes" - {gap}
            WHERE "Id" = {userId} AND "StreakFreezes" >= {gap}
            """, ct);
        if (spent == 0) return;

        for (var i = 1; i <= gap; i++)
        {
            var date = last.Value.AddDays(i);
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO "StudyDays" ("Id", "UserId", "Date", "NewWords", "Reviews", "GrammarItems", "Listens", "Frozen", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {userId}, {date}, 0, 0, 0, 0, TRUE, {DateTimeOffset.UtcNow})
                ON CONFLICT ("UserId", "Date") DO NOTHING
                """, ct);
        }
    }

    private async Task<HashSet<DateOnly>> LoadDatesAsync(Guid userId, CancellationToken ct) =>
        (await db.StudyDays.AsNoTracking().Where(d => d.UserId == userId).Select(d => d.Date).ToListAsync(ct)).ToHashSet();

    /// <summary>Consecutive days ending today, or yesterday when today has no activity yet.</summary>
    internal static int CurrentStreak(HashSet<DateOnly> dates, DateOnly today) =>
        RunEndingOn(dates, dates.Contains(today) ? today : today.AddDays(-1));

    internal static int LongestRun(HashSet<DateOnly> dates)
    {
        var best = 0;
        foreach (var start in dates.Where(d => !dates.Contains(d.AddDays(-1))))
        {
            var length = 1;
            while (dates.Contains(start.AddDays(length))) length++;
            best = Math.Max(best, length);
        }
        return best;
    }

    private static int CefrRank(string level)
    {
        var i = Array.IndexOf(CefrOrder, level);
        return i < 0 ? int.MaxValue : i;
    }

    private static int[] ToLevelArray(IEnumerable<(int Level, int Count)> groups)
    {
        var levels = new int[6];
        foreach (var (level, count) in groups) levels[Math.Clamp(level, 1, 6) - 1] += count;
        return levels;
    }

    private static List<CefrProgressDto> ByCefr(IEnumerable<(string Level, int Count)> totals, IEnumerable<(string Level, int Count)> done)
    {
        var doneByLevel = done.ToDictionary(x => x.Level, x => x.Count);
        return totals
            .OrderBy(t => CefrRank(t.Level))
            .Select(t => new CefrProgressDto(t.Level, doneByLevel.GetValueOrDefault(t.Level), t.Count))
            .ToList();
    }
}
