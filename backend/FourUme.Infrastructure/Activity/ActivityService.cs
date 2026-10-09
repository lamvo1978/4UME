using FourUme.Application.Activity;
using FourUme.Domain.Enums;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Activity;

public class ActivityService(AppDbContext db, IClientClock clock, ILogger<ActivityService> logger) : IActivityService
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
            .Where(p => p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0)
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
    internal static int CurrentStreak(HashSet<DateOnly> dates, DateOnly today)
    {
        var day = dates.Contains(today) ? today : today.AddDays(-1);
        var count = 0;
        while (dates.Contains(day))
        {
            count++;
            day = day.AddDays(-1);
        }
        return count;
    }

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
