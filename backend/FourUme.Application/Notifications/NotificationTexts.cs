using System.Text.RegularExpressions;

namespace FourUme.Application.Notifications;

/// <summary>
/// Wording of the reminders the app schedules on the phone, edited in the admin (Thông báo).
/// Lists rotate by day so consecutive days get different variants. Placeholders in braces are filled in by the app.
/// Missing properties keep these defaults, so new texts need no data migration.
/// </summary>
public record NotificationTexts
{
    public const string SettingKey = "notificationTexts";

    /// <summary>{what} = "12 từ và 2 bài ngữ pháp".</summary>
    public List<string> DueTitles { get; init; } = ["Có {what} cần ôn hôm nay", "{what} đang chờ bạn ôn lại", "Đến giờ ôn {what} rồi"];
    public List<string> NewWordsTitles { get; init; } = ["Học {count} từ mới hôm nay nhé", "{count} từ mới đang đợi bạn", "Thêm {count} từ mới vào vốn từ nào"];
    public List<string> EncouragementTitles { get; init; } = ["Vài phút tiếng Anh mỗi ngày", "Hôm nay mình học gì nhỉ?", "Một chút mỗi ngày, tiến bộ mỗi tuần"];
    public List<string> StartStreakLines { get; init; } = ["Chỉ cần 5 phút để bắt đầu chuỗi ngày học.", "Bắt đầu chuỗi ngày học từ hôm nay nhé."];
    public List<string> StreakLines { get; init; } = ["Giữ chuỗi {streak} ngày nhé!", "Chuỗi {streak} ngày đang chờ bạn nối dài.", "Đừng để chuỗi {streak} ngày tắt lửa nhé."];
    public string MilestoneTomorrow { get; init; } = "Học hôm nay là đạt mốc {milestone} ngày!";
    public string MilestoneSoon { get; init; } = "Còn {days} ngày nữa là đạt mốc {milestone} ngày!";

    public string RescueFreezeTitle { get; init; } = "Hôm nay bạn chưa học";
    public List<string> RescueFreezeBodies { get; init; } =
    [
        "Bỏ lỡ hôm nay sẽ tốn 1 lượt đóng băng của chuỗi {streak} ngày. 3 phút ôn tập là đủ!",
        "Giữ lượt đóng băng cho lúc cần hơn — học nhanh vài từ để nối chuỗi {streak} ngày nhé.",
    ];
    /// <summary>{left} = "2 tiếng" or "chưa đầy 1 tiếng".</summary>
    public List<string> RescueTitles { get; init; } = ["Còn {left} nữa là mất chuỗi {streak} ngày", "Chuỗi {streak} ngày sắp tắt lửa"];
    public List<string> RescueBodies { get; init; } =
        ["3 phút ôn tập là đủ để giữ chuỗi!", "Học nhanh vài từ trước khi đi ngủ nhé.", "Một lượt ôn ngắn thôi là chuỗi được cứu."];

    public List<string> ComebackTitles { get; init; } = ["Lâu rồi không gặp!", "4UME nhớ bạn đấy", "Quay lại học chút nhé?"];
    public string ComebackDueBody { get; init; } = "Đã {days} ngày rồi — ôn lại {count} từ cũ trong 2 phút nhé.";
    public string ComebackNewBody { get; init; } = "Đã {days} ngày rồi — học vài từ mới để bắt đầu lại chuỗi nhé.";

    public string PromptTitle { get; init; } = "Giữ lửa mỗi ngày nhé?";
    public string PromptBody { get; init; } = "4UME sẽ nhắc bạn học lúc {time} mỗi ngày. Bạn đổi giờ hoặc tắt bất cứ lúc nào trong Hồ sơ › Cài đặt.";
}

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminNotificationTextsDto(NotificationTexts Value, NotificationTexts Defaults, DateTimeOffset? UpdatedAt);

public static partial class NotificationTextRules
{
    public const int MaxVariants = 8;
    public const int MaxTitle = 90;
    public const int MaxBody = 180;

    private record Field(string Label, IReadOnlyList<string> Values, int Max, string[] Placeholders);

    private static IEnumerable<Field> Fields(NotificationTexts t) =>
    [
        new("Nhắc học · có bài cần ôn", t.DueTitles, MaxTitle, ["what"]),
        new("Nhắc học · còn từ mới", t.NewWordsTitles, MaxTitle, ["count"]),
        new("Nhắc học · đã xong mục tiêu", t.EncouragementTitles, MaxTitle, []),
        new("Dòng phụ · chưa có chuỗi", t.StartStreakLines, MaxBody, []),
        new("Dòng phụ · đang có chuỗi", t.StreakLines, MaxBody, ["streak"]),
        new("Dòng phụ · mai đạt mốc", [t.MilestoneTomorrow], MaxBody, ["milestone"]),
        new("Dòng phụ · sắp đạt mốc", [t.MilestoneSoon], MaxBody, ["days", "milestone"]),
        new("Cứu chuỗi · tiêu đề khi còn đóng băng", [t.RescueFreezeTitle], MaxTitle, ["streak"]),
        new("Cứu chuỗi · nội dung khi còn đóng băng", t.RescueFreezeBodies, MaxBody, ["streak"]),
        new("Cứu chuỗi · tiêu đề", t.RescueTitles, MaxTitle, ["streak", "left"]),
        new("Cứu chuỗi · nội dung", t.RescueBodies, MaxBody, ["streak"]),
        new("Quay lại học · tiêu đề", t.ComebackTitles, MaxTitle, ["days"]),
        new("Quay lại học · nội dung khi có từ cần ôn", [t.ComebackDueBody], MaxBody, ["days", "count"]),
        new("Quay lại học · nội dung khi không có từ cần ôn", [t.ComebackNewBody], MaxBody, ["days"]),
        new("Hỏi bật nhắc học · tiêu đề", [t.PromptTitle], MaxTitle, ["time"]),
        new("Hỏi bật nhắc học · nội dung", [t.PromptBody], MaxBody * 2, ["time"]),
    ];

    public static NotificationTexts Normalize(NotificationTexts t) => t with
    {
        DueTitles = List(t.DueTitles),
        NewWordsTitles = List(t.NewWordsTitles),
        EncouragementTitles = List(t.EncouragementTitles),
        StartStreakLines = List(t.StartStreakLines),
        StreakLines = List(t.StreakLines),
        MilestoneTomorrow = (t.MilestoneTomorrow ?? "").Trim(),
        MilestoneSoon = (t.MilestoneSoon ?? "").Trim(),
        RescueFreezeTitle = (t.RescueFreezeTitle ?? "").Trim(),
        RescueFreezeBodies = List(t.RescueFreezeBodies),
        RescueTitles = List(t.RescueTitles),
        RescueBodies = List(t.RescueBodies),
        ComebackTitles = List(t.ComebackTitles),
        ComebackDueBody = (t.ComebackDueBody ?? "").Trim(),
        ComebackNewBody = (t.ComebackNewBody ?? "").Trim(),
        PromptTitle = (t.PromptTitle ?? "").Trim(),
        PromptBody = (t.PromptBody ?? "").Trim(),
    };

    public static List<string> Validate(NotificationTexts t)
    {
        var problems = new List<string>();
        foreach (var f in Fields(t))
        {
            if (f.Values.Count == 0 || f.Values.Any(v => v.Length == 0)) problems.Add($"{f.Label}: chưa có nội dung.");
            if (f.Values.Count > MaxVariants) problems.Add($"{f.Label}: tối đa {MaxVariants} câu.");
            if (f.Values.Any(v => v.Length > f.Max)) problems.Add($"{f.Label}: mỗi câu tối đa {f.Max} ký tự.");
            var unknown = f.Values
                .SelectMany(v => Placeholder().Matches(v).Select(m => m.Groups[1].Value))
                .Where(p => !f.Placeholders.Contains(p))
                .Distinct()
                .ToList();
            if (unknown.Count > 0)
            {
                var allowed = f.Placeholders.Length == 0 ? "không dùng chỗ trống nào" : $"chỉ dùng {string.Join(", ", f.Placeholders.Select(p => $"{{{p}}}"))}";
                problems.Add($"{f.Label}: {string.Join(", ", unknown.Select(p => $"{{{p}}}"))} không hợp lệ — {allowed}.");
            }
        }
        return problems;
    }

    private static List<string> List(IEnumerable<string>? items) =>
        (items ?? []).Select(s => (s ?? "").Trim()).Where(s => s.Length > 0).ToList();

    [GeneratedRegex(@"\{(\w+)\}")]
    private static partial Regex Placeholder();
}
