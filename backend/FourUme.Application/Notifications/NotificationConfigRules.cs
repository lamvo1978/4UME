namespace FourUme.Application.Notifications;

/// <summary>Constraints from docs/notifications.md ("Thông số hệ thống"), shared by the admin save and restore.</summary>
public static class NotificationConfigRules
{
    public const int MinPerDay = 1;
    public const int MaxPerDay = 3;
    public const int MaxRescueMinStreak = 30;
    /// <summary>The app schedules local reminders one week ahead, so later comeback days can't fire locally.</summary>
    public const int MaxComebackDayLocal = 7;
    public const int MaxComebackDayPush = 60;
    public const int MaxComebackEntries = 6;

    public static List<string> Validate(NotificationConfig c)
    {
        var problems = new List<string>();
        var rescue = Time(c.RescueTime, "Giờ cứu chuỗi", problems);
        var quietStart = Time(c.QuietStart, "Giờ bắt đầu yên tĩnh", problems);
        var quietEnd = Time(c.QuietEnd, "Giờ kết thúc yên tĩnh", problems);
        var weekly = Time(c.WeeklyTime, "Giờ tổng kết tuần", problems);
        var freeze = Time(c.FreezeNoticeTime, "Giờ báo dùng lượt đóng băng", problems);

        if (quietStart is { } qs && quietEnd is { } qe)
        {
            if (rescue is { } r && InQuiet(r, qs, qe)) problems.Add("Giờ cứu chuỗi phải nằm ngoài giờ yên tĩnh (trước giờ bắt đầu yên tĩnh).");
            if (weekly is { } w && InQuiet(w, qs, qe)) problems.Add("Giờ tổng kết tuần đang nằm trong giờ yên tĩnh.");
            if (freeze is { } f && InQuiet(f, qs, qe)) problems.Add("Giờ báo dùng lượt đóng băng đang nằm trong giờ yên tĩnh.");
        }

        if (c.MaxPerDay is < MinPerDay or > MaxPerDay) problems.Add($"Số thông báo tối đa mỗi ngày phải từ {MinPerDay} đến {MaxPerDay}.");
        if (c.RescueMinStreak is < 1 or > MaxRescueMinStreak) problems.Add($"Chuỗi tối thiểu để cứu chuỗi phải từ 1 đến {MaxRescueMinStreak} ngày.");
        if (c.WeeklyDay is < 0 or > 6) problems.Add("Ngày tổng kết tuần không hợp lệ.");
        Days(c.ComebackDaysLocal, MaxComebackDayLocal, "Ngày nhắc quay lại (trên máy)", problems);
        Days(c.ComebackDaysPush, MaxComebackDayPush, "Ngày nhắc quay lại (từ server)", problems);
        return problems;
    }

    /// <summary>Sorted, de-duplicated copy so equal settings serialize identically.</summary>
    public static NotificationConfig Normalize(NotificationConfig c) => c with
    {
        RescueTime = c.RescueTime.Trim(),
        QuietStart = c.QuietStart.Trim(),
        QuietEnd = c.QuietEnd.Trim(),
        WeeklyTime = c.WeeklyTime.Trim(),
        FreezeNoticeTime = c.FreezeNoticeTime.Trim(),
        ComebackDaysLocal = c.ComebackDaysLocal.Distinct().Order().ToList(),
        ComebackDaysPush = c.ComebackDaysPush.Distinct().Order().ToList(),
    };

    private static int? Time(string? value, string label, List<string> problems)
    {
        if (TimeOnly.TryParseExact(value?.Trim(), "HH:mm", out var t)) return t.Hour * 60 + t.Minute;
        problems.Add($"{label} phải có dạng giờ:phút, ví dụ 22:00.");
        return null;
    }

    private static bool InQuiet(int minutes, int start, int end) =>
        start != end && (start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end);

    private static void Days(IReadOnlyList<int>? days, int max, string label, List<string> problems)
    {
        if (days is null) return;
        if (days.Count > MaxComebackEntries) problems.Add($"{label}: tối đa {MaxComebackEntries} mốc.");
        if (days.Any(d => d < 1 || d > max)) problems.Add($"{label}: mỗi mốc phải từ 1 đến {max} ngày.");
    }
}
