namespace FourUme.Application.Premium;

/// <param name="Icon">One of <see cref="PremiumPerkRules.Icons"/> (Ionicons names in the app).</param>
/// <param name="Title">
/// The app replaces "{n}" with the Premium daily pronunciation limit, "{aiSession}" / "{aiTurns}" with conversation
/// session/turn counts, "{w}" / "{wFree}" with the Premium / free daily writing checks (also in <paramref name="Body"/>).
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
/// <param name="IapEnabled">When true, the app may offer store purchase flows (Phase 2 IAP).</param>
public record PremiumPerks(
    List<PremiumPerk> Perks,
    List<PremiumPlan>? Plans = null,
    bool ShowPrices = true,
    List<PremiumPlan>? AddonPlans = null,
    bool IapEnabled = false)
{
    public const string SettingKey = "premium";

    public static List<PremiumPlan> DefaultPlans() =>
    [
        new(1, 19_000),
        new(3, 54_000),
        new(6, 99_000),
        new(12, 159_000, "Tiết kiệm nhất"),
    ];

    public static List<PremiumPlan> DefaultAddonPlans() =>
    [
        new(1, 15_000),
        new(3, 39_000),
        new(6, 72_000),
        new(12, 120_000),
    ];

    public static PremiumPerks Default() => new(
    [
        new("pulse-outline", "Chấm phát âm chi tiết {n} lượt/ngày", "Biết điểm từng âm, luyện tới khi chuẩn."),
        new("create-outline", "Luyện viết với AI {w} bài/ngày", "AI chấm điểm, sửa lỗi, viết lại cả đoạn; xem lại mọi bài đã viết. Gói miễn phí: {wFree} bài/ngày."),
        new("sparkles-outline", "Đàm thoại AI — {aiSession} buổi/ngày", "Mỗi buổi tối đa {aiTurns} lượt (nói hoặc gõ). AI sửa câu và tổng kết cuối buổi."),
        new("ban-outline", "Không quảng cáo", "Không banner ở Trang chủ, không quảng cáo đổi lượt chấm."),
        new("snow-outline", "Thêm lượt đóng băng chuỗi", "Giữ tối đa 4 lượt (+1 lần học đầu tháng). Miễn phí: tối đa 2, +1 mỗi 7 ngày chuỗi."),
        new("headset-outline", "Luyện nghe – nói, nghe – chép", "Nghe câu bản xứ rồi nói lại hoặc chép lại (quà chuỗi 7 ngày mở thêm như hiện tại)."),
        new("chatbubbles-outline", "Mở rộng đàm thoại AI", "Thêm {addonSession} buổi/ngày, tối đa {addonTurns} lượt/buổi (trần {addonCap} lượt/ngày từ gói mở rộng). Gói riêng, cần Premium.", Visible: true),
        new("heart-outline", "Ủng hộ 4UME", "Giúp 4UME có thêm bài học và nội dung mới."),
        new("stats-chart-outline", "Thống kê âm hay đọc sai", "Gom những âm bạn hay sai và gợi ý từ để luyện lại đúng âm đó.", Soon: true, Visible: false),
        new("cloud-download-outline", "Nghe không cần mạng", "Tải bài nghe về máy để nghe mọi lúc.", Soon: true, Visible: false),
        new("chatbubbles-outline", "Luyện nói cả câu", "Chấm phát âm cả câu ví dụ và câu trong bài nghe.", Soon: true, Visible: false),
        new("school-outline", "Bộ từ chuyên đề", "Bộ từ cho IELTS, công việc, du lịch.", Soon: true, Visible: false),
        new("ribbon-outline", "Huy hiệu Premium", "Khung ảnh đại diện và huy hiệu riêng.", Soon: true, Visible: false),
    ], DefaultPlans(), ShowPrices: true, DefaultAddonPlans());
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

    public const int MaxPerks = 14;
    public const int MaxTitle = 80;
    public const int MaxBody = 200;

    public const int MaxPlans = 4;
    public const int MaxAddonPlans = 4;
    public const int MaxPlanMonths = 36;
    public const int MinPrice = 1_000;
    public const int MaxPrice = 10_000_000;
    public const int MaxBadge = 30;

    public static PremiumPerks Normalize(PremiumPerks p) => new(
        (p.Perks ?? []).Select(x => new PremiumPerk(
            x.Icon?.Trim() ?? "", (x.Title ?? "").Trim(), (x.Body ?? "").Trim(), x.Soon, x.Visible)).ToList(),
        (p.Plans ?? DefaultPlans()).Select(x => x with { Badge = (x.Badge ?? "").Trim() }).OrderBy(x => x.Months).ToList(),
        p.ShowPrices,
        (p.AddonPlans ?? DefaultAddonPlans()).Select(x => x with { Badge = (x.Badge ?? "").Trim() }).OrderBy(x => x.Months).ToList(),
        p.IapEnabled);

    public static List<string> Validate(PremiumPerks p)
    {
        var problems = new List<string>();
        if (p.Perks.Count > MaxPerks) problems.Add($"Tối đa {MaxPerks} quyền lợi.");
        problems.AddRange(ValidatePlans(p.Plans ?? [], MaxPlans, "Premium"));
        problems.AddRange(ValidatePlans(p.AddonPlans ?? [], MaxAddonPlans, "Mở rộng"));
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

    private static IEnumerable<string> ValidatePlans(IReadOnlyList<PremiumPlan> plans, int max, string label)
    {
        var problems = new List<string>();
        if (plans.Count > max) problems.Add($"Tối đa {max} gói giá {label}.");
        if (plans.GroupBy(x => x.Months).Any(g => g.Count() > 1)) problems.Add($"Hai gói giá {label} trùng số tháng.");
        foreach (var plan in plans)
        {
            var where = $"{label} {plan.Months} tháng";
            if (plan.Months is < 1 or > MaxPlanMonths) problems.Add($"Số tháng của gói phải từ 1 đến {MaxPlanMonths}.");
            if (plan.Price is < MinPrice or > MaxPrice) problems.Add($"{where}: giá phải từ {MinPrice:N0}đ đến {MaxPrice:N0}đ.");
            if (plan.Badge.Length > MaxBadge) problems.Add($"{where}: nhãn tối đa {MaxBadge} ký tự.");
        }
        return problems;
    }

    /// <summary>What the app shows: hidden perks removed; price lists respect <see cref="PremiumPerks.ShowPrices"/> (labelled “Sắp mở bán” in app until IAP).</summary>
    public static PremiumPerks Visible(PremiumPerks p)
    {
        var plans = (p.Plans ?? DefaultPlans()).Where(x => x.Visible).OrderBy(x => x.Months).ToList();
        var addon = (p.AddonPlans ?? DefaultAddonPlans()).Where(x => x.Visible).OrderBy(x => x.Months).ToList();
        if (!p.ShowPrices)
        {
            plans = [];
            addon = [];
        }
        return new(p.Perks.Where(x => x.Visible).ToList(), plans, p.ShowPrices, addon, p.IapEnabled);
    }

    private static List<PremiumPlan> DefaultPlans() => PremiumPerks.DefaultPlans();
    private static List<PremiumPlan> DefaultAddonPlans() => PremiumPerks.DefaultAddonPlans();
}

public interface IPremiumPerksService
{
    /// <summary>Stored list, or <see cref="PremiumPerks.Default"/> when the admin hasn't saved one.</summary>
    Task<PremiumPerks> GetAsync(CancellationToken ct = default);
}
