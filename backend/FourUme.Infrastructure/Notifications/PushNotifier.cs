using FourUme.Application.Activity;
using FourUme.Application.Notifications;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Notifications;

/// <summary>
/// Pushes sent by the server, for what the app's local reminders can't do: the weekly summary with real numbers,
/// reminders after a long absence (local schedules run out 7 days after the app was last opened) and feedback replies.
/// Daily, rescue and short-absence reminders stay local on the phone.
/// </summary>
public class PushNotifier(AppDbContext db, INotificationService notifications, ExpoPushClient expo, ILogger<PushNotifier> logger) : IPushNotifier
{
    /// <summary>A scheduled push goes out within this many minutes after its time; the log keeps it to once a day.</summary>
    private const int WindowMinutes = 60;
    private const int MaxReplyPreview = 120;
    private static readonly TimeZoneInfo DefaultZone = TimeZoneInfo.CreateCustomTimeZone("ICT", TimeSpan.FromHours(7), "ICT", "ICT");
    private static readonly string[] ScheduledKinds = [PushKinds.Weekly, PushKinds.Comeback];

    public Task<PushResult> SendTestAsync(Guid userId, CancellationToken ct = default) =>
        DeliverAsync(userId, new PushMessage(
            "Thông báo thử từ 4UME",
            "Nếu bạn thấy dòng này, thông báo từ máy chủ đã chạy tốt.",
            new Dictionary<string, string>()), ct);

    public async Task FeedbackReplyAsync(Guid userId, Guid ticketId, string subject, string reply, CancellationToken ct = default)
    {
        try
        {
            var zone = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.TimeZone).FirstOrDefaultAsync(ct);
            var config = await notifications.GetConfigAsync(ct);
            var local = LocalNow(zone, DateTimeOffset.UtcNow);
            if (InQuietHours(local.Hour * 60 + local.Minute, config)) return;

            var texts = await notifications.GetTextsAsync(ct);
            var preview = reply.ReplaceLineEndings(" ").Trim();
            if (preview.Length > MaxReplyPreview) preview = preview[..(MaxReplyPreview - 1)].TrimEnd() + "…";
            var values = new Dictionary<string, object> { ["subject"] = subject, ["reply"] = preview };
            await DeliverAsync(userId, new PushMessage(
                NotificationTextRules.Fill(texts.FeedbackReplyTitle, values),
                NotificationTextRules.Fill(texts.FeedbackReplyBody, values),
                new Dictionary<string, string> { ["screen"] = "feedback", ["id"] = ticketId.ToString() }), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not push the feedback reply to {UserId}", userId);
        }
    }

    /// <summary>Called every few minutes; sends what is due in each user's own time zone.</summary>
    public async Task RunScheduledAsync(DateTimeOffset now, CancellationToken ct)
    {
        var config = await notifications.GetConfigAsync(ct);
        var texts = await notifications.GetTextsAsync(ct);
        var comebackDays = config.ComebackDaysPush.Except(config.ComebackDaysLocal).ToHashSet();
        var weeklyAt = ToMinutes(config.WeeklyTime);

        var users = await db.Users.AsNoTracking()
            .Where(u => u.LockedAt == null && u.DeviceTokens.Any())
            .Select(u => new { u.Id, u.TimeZone, u.ReminderEnabled, u.ReminderTime, u.NotifyWeekly })
            .ToListAsync(ct);

        foreach (var u in users)
        {
            try
            {
                var local = LocalNow(u.TimeZone, now);
                var today = DateOnly.FromDateTime(local.DateTime);
                var minutes = local.Hour * 60 + local.Minute;

                if (u.NotifyWeekly && (int)local.DayOfWeek == config.WeeklyDay && InWindow(minutes, weeklyAt))
                    await WeeklyAsync(u.Id, today, texts, config, ct);

                if (u.ReminderEnabled && comebackDays.Count > 0 && InWindow(minutes, ReminderMinutes(u.ReminderTime, config)))
                    await ComebackAsync(u.Id, today, now, comebackDays, texts, config, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Scheduled push failed for {UserId}", u.Id);
            }
        }
    }

    private async Task WeeklyAsync(Guid userId, DateOnly today, NotificationTexts texts, NotificationConfig config, CancellationToken ct)
    {
        if (await SentAsync(userId, PushKinds.Weekly, today, ct)) return;
        var start = WeeklyRules.WeekStart(today).AddDays(-7);
        var end = start.AddDays(6);
        var days = await db.StudyDays.AsNoTracking()
            .Where(d => d.UserId == userId && d.Date >= start && d.Date <= end && !d.Frozen)
            .Select(d => new { d.NewWords, d.Reviews })
            .ToListAsync(ct);
        if (days.Count == 0) return;

        var values = new Dictionary<string, object>
        {
            ["days"] = days.Count, ["words"] = days.Sum(d => d.NewWords), ["reviews"] = days.Sum(d => d.Reviews),
        };
        await SendOnceAsync(userId, PushKinds.Weekly, today, new PushMessage(
            NotificationTextRules.Fill(texts.WeeklyTitle, values),
            NotificationTextRules.Fill(texts.WeeklyBody, values),
            new Dictionary<string, string> { ["screen"] = "weekly", ["start"] = start.ToString("yyyy-MM-dd") }), config, ct);
    }

    private async Task ComebackAsync(
        Guid userId, DateOnly today, DateTimeOffset now, HashSet<int> comebackDays, NotificationTexts texts, NotificationConfig config, CancellationToken ct)
    {
        var last = await db.StudyDays.AsNoTracking()
            .Where(d => d.UserId == userId && !d.Frozen)
            .MaxAsync(d => (DateOnly?)d.Date, ct);
        if (last is null) return;
        var away = today.DayNumber - last.Value.DayNumber;
        if (!comebackDays.Contains(away) || await SentAsync(userId, PushKinds.Comeback, today, ct)) return;

        var due = await db.WordProgresses.CountAsync(
            p => p.UserId == userId && p.Status == WordStatus.Known && p.ReviewLevel > 0 && p.NextReviewAt <= now, ct);
        var values = new Dictionary<string, object> { ["days"] = away, ["count"] = Math.Min(due, 5) };
        await SendOnceAsync(userId, PushKinds.Comeback, today, new PushMessage(
            NotificationTextRules.Fill(NotificationTextRules.Pick(texts.ComebackTitles, today.DayNumber), values),
            NotificationTextRules.Fill(due > 0 ? texts.ComebackDueBody : texts.ComebackNewBody, values),
            new Dictionary<string, string> { ["screen"] = due > 0 ? "practice" : "study" }), config, ct);
    }

    private Task<bool> SentAsync(Guid userId, string kind, DateOnly localDate, CancellationToken ct) =>
        db.NotificationLogs.AnyAsync(l => l.UserId == userId && l.Kind == kind && l.LocalDate == localDate, ct);

    /// <summary>Claims the (user, kind, day) log row first, so a second run or instance can't send it again.</summary>
    private async Task SendOnceAsync(Guid userId, string kind, DateOnly localDate, PushMessage message, NotificationConfig config, CancellationToken ct)
    {
        var sentToday = await db.NotificationLogs.CountAsync(
            l => l.UserId == userId && l.LocalDate == localDate && ScheduledKinds.Contains(l.Kind), ct);
        if (sentToday >= config.MaxPerDay) return;

        var log = new NotificationLog
        {
            UserId = userId, Kind = kind, LocalDate = localDate, Title = Clip(message.Title, 200), Body = Clip(message.Body, 500),
        };
        db.NotificationLogs.Add(log);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.Entry(log).State = EntityState.Detached;
            return;
        }

        var result = await DeliverAsync(userId, message, ct);
        log.Status = result.Sent > 0 ? "sent" : "failed";
        log.SentAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task<PushResult> DeliverAsync(Guid userId, PushMessage message, CancellationToken ct)
    {
        var devices = await db.DeviceTokens.Where(d => d.UserId == userId).ToListAsync(ct);
        if (devices.Count == 0) return new PushResult(0, 0, []);

        var tickets = await expo.SendAsync(devices.Select(d => d.Token).ToList(), message, ct);
        var errors = new List<string>();
        for (var i = 0; i < devices.Count; i++)
        {
            if (tickets[i].Ok) continue;
            errors.Add(tickets[i].Error ?? "Lỗi không rõ");
            if (tickets[i].Unregistered) db.DeviceTokens.Remove(devices[i]);
        }
        if (tickets.Any(t => t.Unregistered)) await db.SaveChangesAsync(ct);
        return new PushResult(devices.Count, tickets.Count(t => t.Ok), errors);
    }

    private static DateTimeOffset LocalNow(string? zone, DateTimeOffset now) =>
        TimeZoneInfo.ConvertTime(now, zone is not null && TimeZoneInfo.TryFindSystemTimeZoneById(zone, out var tz) ? tz : DefaultZone);

    private static int ToMinutes(string time)
    {
        var parts = time.Split(':');
        return int.Parse(parts[0]) * 60 + int.Parse(parts[1]);
    }

    private static bool InWindow(int minutes, int target) => minutes >= target && minutes < target + WindowMinutes;

    /// <summary>Same rule as the app: a reminder time inside quiet hours moves to when they end.</summary>
    private static int ReminderMinutes(string reminderTime, NotificationConfig config)
    {
        var at = ToMinutes(reminderTime);
        return InQuietHours(at, config) ? ToMinutes(config.QuietEnd) : at;
    }

    private static bool InQuietHours(int minutes, NotificationConfig config)
    {
        var start = ToMinutes(config.QuietStart);
        var end = ToMinutes(config.QuietEnd);
        if (start == end) return false;
        return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    }

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max];
}
