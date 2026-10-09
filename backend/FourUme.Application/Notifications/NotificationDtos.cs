namespace FourUme.Application.Notifications;

/// <summary>
/// System-wide notification parameters (docs/notifications.md, "Thông số hệ thống").
/// Times are local "HH:mm"; the app schedules local reminders with them and the server times pushes with them.
/// </summary>
public record NotificationConfig
{
    public const string SettingKey = "notifications";

    public string RescueTime { get; init; } = "22:00";
    public string QuietStart { get; init; } = "22:30";
    public string QuietEnd { get; init; } = "07:00";
    public int MaxPerDay { get; init; } = 2;
    public int RescueMinStreak { get; init; } = 2;
    public IReadOnlyList<int> ComebackDaysLocal { get; init; } = [3, 7];
    public IReadOnlyList<int> ComebackDaysPush { get; init; } = [3, 7, 14, 30];
    /// <summary>0 = Sunday … 6 = Saturday.</summary>
    public int WeeklyDay { get; init; }
    public string WeeklyTime { get; init; } = "19:00";
    public string FreezeNoticeTime { get; init; } = "08:00";
}

public record AppConfigDto(NotificationConfig Notifications);

public record RegisterDeviceRequest(string Token, string Platform, string? AppVersion);
