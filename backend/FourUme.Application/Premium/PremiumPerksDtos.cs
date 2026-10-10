namespace FourUme.Application.Premium;

/// <param name="Icon">One of <see cref="PremiumPerkRules.Icons"/> (Ionicons names in the app).</param>
/// <param name="Title">"{n}" is replaced in the app by the Premium daily pronunciation limit.</param>
/// <param name="Soon">Shown with a "Sắp có" tag: promised but not built yet.</param>
public record PremiumPerk(string Icon, string Title, string Body, bool Soon = false, bool Visible = true);

/// <summary>
/// Benefits listed on the app's Premium screen, edited in the admin. Before selling the subscription through the
/// stores, hide every perk still marked <see cref="PremiumPerk.Soon"/>: store review rejects paywalls that promise
/// features that don't exist yet.
/// </summary>
public record PremiumPerks(List<PremiumPerk> Perks)
{
    public const string SettingKey = "premium";

    public static PremiumPerks Default() => new(
    [
        new("pulse-outline", "Chấm phát âm chi tiết {n} lượt/ngày", "Biết điểm từng âm, luyện tới khi chuẩn."),
        new("ban-outline", "Không quảng cáo", "Học liền mạch, không bị chen ngang.", Soon: true),
        new("stats-chart-outline", "Thống kê âm hay đọc sai", "Gom những âm bạn hay sai và gợi ý từ để luyện lại đúng âm đó.", Soon: true),
        new("snow-outline", "Thêm lượt đóng băng chuỗi", "Thêm lượt giữ chuỗi ngày học mỗi tháng cho những ngày bận.", Soon: true),
        new("cloud-download-outline", "Nghe không cần mạng", "Tải bài nghe về máy để nghe mọi lúc.", Soon: true),
        new("heart-outline", "Ủng hộ 4UME", "Giúp 4UME có thêm bài học và nội dung mới."),
        new("chatbubbles-outline", "Luyện nói cả câu", "Chấm phát âm cả câu ví dụ và câu trong bài nghe.", Soon: true, Visible: false),
        new("school-outline", "Bộ từ chuyên đề", "Bộ từ cho IELTS, công việc, du lịch.", Soon: true, Visible: false),
        new("ribbon-outline", "Huy hiệu Premium", "Khung ảnh đại diện và huy hiệu riêng.", Soon: true, Visible: false),
    ]);
}

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminPremiumPerksDto(PremiumPerks Value, PremiumPerks Defaults, DateTimeOffset? UpdatedAt);

public static class PremiumPerkRules
{
    /// <summary>Icons the admin can pick; the app maps unknown names to a sparkles icon.</summary>
    public static readonly string[] Icons =
    [
        "pulse-outline", "ban-outline", "stats-chart-outline", "snow-outline", "cloud-download-outline", "heart-outline",
        "chatbubbles-outline", "school-outline", "ribbon-outline", "sparkles-outline", "mic-outline", "headset-outline",
        "book-outline", "trophy-outline", "flame-outline", "time-outline", "infinite-outline", "star-outline",
    ];

    public const int MaxPerks = 12;
    public const int MaxTitle = 80;
    public const int MaxBody = 200;

    public static PremiumPerks Normalize(PremiumPerks p) => new(
        (p.Perks ?? []).Select(x => new PremiumPerk(
            x.Icon?.Trim() ?? "", (x.Title ?? "").Trim(), (x.Body ?? "").Trim(), x.Soon, x.Visible)).ToList());

    public static List<string> Validate(PremiumPerks p)
    {
        var problems = new List<string>();
        if (p.Perks.Count > MaxPerks) problems.Add($"Tối đa {MaxPerks} quyền lợi.");
        for (var i = 0; i < p.Perks.Count; i++)
        {
            var perk = p.Perks[i];
            var where = $"Dòng {i + 1}";
            if (!Icons.Contains(perk.Icon)) problems.Add($"{where}: biểu tượng không hợp lệ.");
            if (perk.Title.Length == 0) problems.Add($"{where}: chưa có tiêu đề.");
            if (perk.Title.Length > MaxTitle) problems.Add($"{where}: tiêu đề tối đa {MaxTitle} ký tự.");
            if (perk.Body.Length > MaxBody) problems.Add($"{where}: mô tả tối đa {MaxBody} ký tự.");
        }
        return problems;
    }

    /// <summary>What the app shows: hidden perks removed.</summary>
    public static PremiumPerks Visible(PremiumPerks p) => new(p.Perks.Where(x => x.Visible).ToList());
}

public interface IPremiumPerksService
{
    /// <summary>Stored list, or <see cref="PremiumPerks.Default"/> when the admin hasn't saved one.</summary>
    Task<PremiumPerks> GetAsync(CancellationToken ct = default);
}
