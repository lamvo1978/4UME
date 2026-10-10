namespace FourUme.Application.About;

/// <param name="Icon">One of <see cref="AboutRules.Icons"/> (Ionicons names in the app).</param>
/// <param name="Url">Optional https link opened when the line is tapped.</param>
public record AboutItem(string Icon, string Title, string Body, string? Url = null, bool Visible = true);

public record AboutSection(string Title, List<AboutItem> Items, bool Visible = true);

/// <summary>
/// The app's "Giới thiệu & bản quyền" screen, edited in the admin. The CEFR-J citation is not part of it:
/// its licence requires it to be shown, so the app always renders it.
/// </summary>
public record AboutContent(string Tagline, List<AboutSection> Sections)
{
    public const string SettingKey = "about";

    public static AboutContent Default() => new(
        "Học từ vựng và ngữ pháp tiếng Anh từ A1 đến B2 cho người Việt: ôn tập cách quãng, luyện nghe và luyện phát âm.",
        [
            new("Nội dung học",
            [
                new("book-outline", "Từ vựng",
                    "Danh sách từ và cấp độ A1–B2 dựa trên CEFR-J Wordlist. Nghĩa tiếng Việt, phiên âm và câu ví dụ do 4UME biên soạn."),
                new("document-text-outline", "Ngữ pháp", "Bài học và bài tập do 4UME biên soạn."),
                new("headset-outline", "Bài nghe",
                    "Kịch bản do 4UME biên soạn; một số bài được viết nháp với Google Gemini rồi biên tập lại."),
            ]),
            new("Giọng đọc và AI",
            [
                new("mic-outline", "Giọng đọc bài nghe", "Giọng đọc tổng hợp (AI) của Microsoft Azure AI Speech."),
                new("volume-medium-outline", "Phát âm từ vựng", "Giọng đọc có sẵn trên điện thoại của bạn."),
                new("pulse-outline", "Chấm phát âm",
                    "Microsoft Azure AI Speech (Pronunciation Assessment). Bản ghi giọng chỉ dùng để chấm điểm, 4UME không lưu lại."),
            ]),
            new("Hình ảnh",
            [
                new("image-outline", "Pixabay", "Ảnh minh hoạ từ vựng, dùng theo giấy phép Pixabay Content License.",
                    "https://pixabay.com/service/license-summary/"),
                new("image-outline", "Pexels", "Ảnh minh hoạ từ vựng, dùng theo giấy phép Pexels License.",
                    "https://www.pexels.com/license/"),
                new("color-palette-outline", "Logo và biểu tượng",
                    "Logo và nhận diện 4UME thuộc về 4UME. Biểu tượng trong app là bộ Ionicons (giấy phép MIT)."),
            ]),
        ]);
}

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminAboutDto(AboutContent Value, AboutContent Defaults, DateTimeOffset? UpdatedAt);

public static class AboutRules
{
    /// <summary>Icons the admin can pick; the app maps unknown names to an info icon.</summary>
    public static readonly string[] Icons =
    [
        "book-outline", "document-text-outline", "headset-outline", "mic-outline", "volume-medium-outline", "pulse-outline",
        "image-outline", "color-palette-outline", "information-circle-outline", "school-outline", "sparkles-outline",
        "heart-outline", "globe-outline", "mail-outline", "shield-checkmark-outline", "bulb-outline", "people-outline",
        "code-slash-outline",
    ];

    public const int MaxSections = 12;
    public const int MaxItems = 12;
    public const int MaxTagline = 300;
    public const int MaxTitle = 80;
    public const int MaxBody = 600;

    public static AboutContent Normalize(AboutContent c) => new(
        (c.Tagline ?? "").Trim(),
        (c.Sections ?? []).Select(s => new AboutSection(
            (s.Title ?? "").Trim(),
            (s.Items ?? []).Select(i => new AboutItem(
                i.Icon?.Trim() ?? "", (i.Title ?? "").Trim(), (i.Body ?? "").Trim(),
                string.IsNullOrWhiteSpace(i.Url) ? null : i.Url.Trim(), i.Visible)).ToList(),
            s.Visible)).ToList());

    public static List<string> Validate(AboutContent c)
    {
        var problems = new List<string>();
        if (c.Tagline.Length > MaxTagline) problems.Add($"Câu giới thiệu tối đa {MaxTagline} ký tự.");
        if (c.Sections.Count > MaxSections) problems.Add($"Tối đa {MaxSections} mục.");
        for (var s = 0; s < c.Sections.Count; s++)
        {
            var section = c.Sections[s];
            var where = $"Mục {s + 1}";
            if (section.Title.Length == 0) problems.Add($"{where}: chưa có tiêu đề.");
            if (section.Title.Length > MaxTitle) problems.Add($"{where}: tiêu đề tối đa {MaxTitle} ký tự.");
            if (section.Items.Count == 0) problems.Add($"{where}: cần ít nhất một dòng.");
            if (section.Items.Count > MaxItems) problems.Add($"{where}: tối đa {MaxItems} dòng.");
            for (var i = 0; i < section.Items.Count; i++)
            {
                var item = section.Items[i];
                var line = $"{where}, dòng {i + 1}";
                if (!Icons.Contains(item.Icon)) problems.Add($"{line}: biểu tượng không hợp lệ.");
                if (item.Title.Length == 0) problems.Add($"{line}: chưa có tiêu đề.");
                if (item.Title.Length > MaxTitle) problems.Add($"{line}: tiêu đề tối đa {MaxTitle} ký tự.");
                if (item.Body.Length > MaxBody) problems.Add($"{line}: nội dung tối đa {MaxBody} ký tự.");
                if (item.Url is not null && !(Uri.TryCreate(item.Url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps))
                    problems.Add($"{line}: liên kết phải bắt đầu bằng https://.");
            }
        }
        return problems;
    }

    /// <summary>What the app shows: hidden sections and lines removed, empty sections dropped.</summary>
    public static AboutContent Visible(AboutContent c) => new(
        c.Tagline,
        c.Sections.Where(s => s.Visible)
            .Select(s => s with { Items = s.Items.Where(i => i.Visible).ToList() })
            .Where(s => s.Items.Count > 0)
            .ToList());
}

public interface IAboutService
{
    /// <summary>Stored content, or <see cref="AboutContent.Default"/> when the admin hasn't saved any.</summary>
    Task<AboutContent> GetAsync(CancellationToken ct = default);
}
