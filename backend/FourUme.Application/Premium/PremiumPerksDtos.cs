namespace FourUme.Application.Premium;

/// <param name="Icon">One of <see cref="PremiumPerkRules.Icons"/> (Ionicons names in the app).</param>
/// <param name="Title">
/// The app replaces "{n}" with the Premium daily pronunciation limit, "{ai}" / "{aiFree}" with the Premium / free
/// daily AI conversation turns, "{w}" / "{wFree}" with the Premium / free daily writing checks (also in <paramref name="Body"/>).
/// </param>
/// <param name="Soon">Shown with a "Sắp có" tag: promised but not built yet.</param>
public record PremiumPerk(string Icon, string Title, string Body, bool Soon = false, bool Visible = true);

/// <param name="Months">Length of the plan; the app shows the monthly equivalent and the saving against the 1-month plan.</param>
/// <param name="Price">Price in VND, as set in the stores.</param>
/// <param name="Badge">Short highlight such as "Tiết kiệm nhất"; empty for none.</param>
public record PremiumPlan(int Months, int Price, string Badge = "", bool Visible = true);

/// <summary>
/// Benefits and price list on the app's Premium screen, edited in the admin. Before selling the subscription through
/// the stores, hide every perk still marked <see cref="PremiumPerk.Soon"/>: store review rejects paywalls that promise
/// features that don't exist yet.
/// </summary>
/// <param name="ShowPrices">Show <see cref="Plans"/> in the app (labelled "Sắp mở bán" until in-app purchase ships).</param>
public record PremiumPerks(List<PremiumPerk> Perks, List<PremiumPlan>? Plans = null, bool ShowPrices = true)
{
    public const string SettingKey = "premium";

    public static List<PremiumPlan> DefaultPlans() =>
    [
        new(1, 19_000),
        new(6, 99_000),
        new(12, 159_000, "Tiết kiệm nhất"),
    ];

    public static PremiumPerks Default() => new(
    [
        new("pulse-outline", "Chấm phát âm chi tiết {n} lượt/ngày", "Biết điểm từng âm, luyện tới khi chuẩn."),
        new("sparkles-outline", "Đàm thoại với AI {ai} lượt/ngày", "Nhập vai theo tình huống hoặc trò chuyện tự do, AI sửa câu ngay và tổng kết cuối buổi. Gói miễn phí: {aiFree} lượt/ngày."),
        new("create-outline", "Luyện viết với AI {w} bài/ngày", "AI chấm điểm, sửa lỗi, viết lại cả đoạn và lưu toàn bộ bài đã viết. Gói miễn phí: {wFree} bài/ngày."),
        new("headset-outline", "Luyện nghe – nói, nghe – chép", "Nghe câu của người bản xứ rồi nói lại hoặc chép lại, máy so từng từ. Gói miễn phí: thử 1 lượt và được mở vào ngày quà giữ chuỗi."),
        new("ban-outline", "Không quảng cáo", "Không banner ở Trang chủ và không quảng cáo đổi lượt chấm phát âm."),
        new("stats-chart-outline", "Thống kê âm hay đọc sai", "Gom những âm bạn hay sai và gợi ý từ để luyện lại đúng âm đó.", Soon: true),
        new("snow-outline", "Thêm lượt đóng băng chuỗi", "Thêm lượt giữ chuỗi ngày học mỗi tháng cho những ngày bận.", Soon: true),
        new("cloud-download-outline", "Nghe không cần mạng", "Tải bài nghe về máy để nghe mọi lúc.", Soon: true),
        new("heart-outline", "Ủng hộ 4UME", "Giúp 4UME có thêm bài học và nội dung mới."),
        new("chatbubbles-outline", "Luyện nói cả câu", "Chấm phát âm cả câu ví dụ và câu trong bài nghe.", Soon: true, Visible: false),
        new("school-outline", "Bộ từ chuyên đề", "Bộ từ cho IELTS, công việc, du lịch.", Soon: true, Visible: false),
        new("ribbon-outline", "Huy hiệu Premium", "Khung ảnh đại diện và huy hiệu riêng.", Soon: true, Visible: false),
    ], DefaultPlans(), ShowPrices: false);
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
        "book-outline", "trophy-outline", "flame-outline", "time-outline", "infinite-outline", "star-outline", "create-outline",
    ];

    public const int MaxPerks = 12;
    public const int MaxTitle = 80;
    public const int MaxBody = 200;

    public const int MaxPlans = 4;
    public const int MaxPlanMonths = 36;
    public const int MinPrice = 1_000;
    public const int MaxPrice = 10_000_000;
    public const int MaxBadge = 30;

    public static PremiumPerks Normalize(PremiumPerks p) => new(
        (p.Perks ?? []).Select(x => new PremiumPerk(
            x.Icon?.Trim() ?? "", (x.Title ?? "").Trim(), (x.Body ?? "").Trim(), x.Soon, x.Visible)).ToList(),
        (p.Plans ?? PremiumPerks.DefaultPlans()).Select(x => x with { Badge = (x.Badge ?? "").Trim() }).OrderBy(x => x.Months).ToList(),
        p.ShowPrices);

    public static List<string> Validate(PremiumPerks p)
    {
        var problems = new List<string>();
        if (p.Perks.Count > MaxPerks) problems.Add($"Tối đa {MaxPerks} quyền lợi.");
        var plans = p.Plans ?? [];
        if (plans.Count > MaxPlans) problems.Add($"Tối đa {MaxPlans} gói giá.");
        if (plans.GroupBy(x => x.Months).Any(g => g.Count() > 1)) problems.Add("Hai gói giá trùng số tháng.");
        foreach (var plan in plans)
        {
            var where = $"Gói {plan.Months} tháng";
            if (plan.Months is < 1 or > MaxPlanMonths) problems.Add($"Số tháng của gói phải từ 1 đến {MaxPlanMonths}.");
            if (plan.Price is < MinPrice or > MaxPrice) problems.Add($"{where}: giá phải từ {MinPrice:N0}đ đến {MaxPrice:N0}đ.");
            if (plan.Badge.Length > MaxBadge) problems.Add($"{where}: nhãn tối đa {MaxBadge} ký tự.");
        }
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

    /// <summary>What the app shows: hidden perks and plans removed, no plans while prices are switched off.</summary>
    public static PremiumPerks Visible(PremiumPerks p) => new(
        p.Perks.Where(x => x.Visible).ToList(),
        p.ShowPrices ? (p.Plans ?? PremiumPerks.DefaultPlans()).Where(x => x.Visible).OrderBy(x => x.Months).ToList() : [],
        p.ShowPrices);
}

public interface IPremiumPerksService
{
    /// <summary>Stored list, or <see cref="PremiumPerks.Default"/> when the admin hasn't saved one.</summary>
    Task<PremiumPerks> GetAsync(CancellationToken ct = default);
}
