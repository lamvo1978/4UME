namespace FourUme.Application.Feedback;

public static class FeedbackCategories
{
    public const string Idea = "idea";
    public const string Bug = "bug";
    public const string Content = "content";
    public const string Other = "other";
    public static readonly string[] All = [Idea, Bug, Content, Other];

    public static string Label(string category) => category switch
    {
        Bug => "Báo lỗi",
        Content => "Nội dung sai",
        Other => "Khác",
        _ => "Góp ý",
    };
}

public static class FeedbackStatuses
{
    /// <summary>Waiting for the admin.</summary>
    public const string Open = "open";
    /// <summary>The admin replied; waiting for the learner.</summary>
    public const string Answered = "answered";
    public const string Closed = "closed";
}

/// <param name="Title">Shown in the admin's reply picker.</param>
public record FeedbackReplyTemplate(string Title, string Body);

/// <summary>Admin settings for feedback, stored in AppSettings under <see cref="SettingKey"/>.</summary>
/// <param name="Recipients">Addresses emailed when a learner writes.</param>
/// <param name="DailyLimit">New tickets per learner per day.</param>
/// <param name="AutoCloseDays">An answered ticket closes after this many days without a reply from the learner.</param>
public record FeedbackSettings(List<string> Recipients, List<FeedbackReplyTemplate> Replies, int DailyLimit = 5, int AutoCloseDays = 14)
{
    public const string SettingKey = "feedback";

    public static FeedbackSettings Default() => new(
        ["lamvo1978@gmail.com"],
        [
            new("Cảm ơn góp ý", "Cảm ơn bạn đã góp ý cho 4UME! Mình đã ghi nhận và sẽ cân nhắc trong các bản cập nhật tới."),
            new("Đã sửa", "Cảm ơn bạn đã báo! Mình đã sửa xong, bạn mở lại app để thấy nội dung mới nhé."),
            new("Cần thêm thông tin", "Cảm ơn bạn! Bạn mô tả thêm giúp mình: lỗi xảy ra ở màn nào, bạn đã bấm gì trước đó? Có ảnh chụp màn hình càng tốt."),
        ]);
}

public record AdminFeedbackSettingsDto(FeedbackSettings Value, FeedbackSettings Defaults, DateTimeOffset? UpdatedAt);

public static class FeedbackRules
{
    public const int MaxBody = 2000;
    public const int MaxImages = 3;
    public const int MaxRecipients = 5;
    public const int MaxReplies = 20;
    public const int MaxReplyTitle = 60;
    /// <summary>Messages (new tickets and replies) per learner per day, against flooding.</summary>
    public const int MaxMessagesPerDay = 30;
    public const int SubjectLength = 80;

    public static FeedbackSettings Normalize(FeedbackSettings s) => new(
        (s.Recipients ?? []).Select(r => (r ?? "").Trim().ToLowerInvariant()).Where(r => r.Length > 0).Distinct().ToList(),
        (s.Replies ?? []).Select(r => new FeedbackReplyTemplate((r.Title ?? "").Trim(), (r.Body ?? "").Trim())).ToList(),
        s.DailyLimit,
        s.AutoCloseDays);

    public static List<string> Validate(FeedbackSettings s)
    {
        var problems = new List<string>();
        if (s.Recipients.Count > MaxRecipients) problems.Add($"Tối đa {MaxRecipients} email nhận.");
        foreach (var r in s.Recipients)
        {
            if (!System.Net.Mail.MailAddress.TryCreate(r, out var parsed) || parsed.Address != r || !parsed.Host.Contains('.'))
                problems.Add($"Email \"{r}\" không hợp lệ.");
        }
        if (s.Replies.Count > MaxReplies) problems.Add($"Tối đa {MaxReplies} câu trả lời mẫu.");
        for (var i = 0; i < s.Replies.Count; i++)
        {
            var r = s.Replies[i];
            if (r.Title.Length == 0 || r.Body.Length == 0) problems.Add($"Câu trả lời mẫu {i + 1}: cần cả tên và nội dung.");
            if (r.Title.Length > MaxReplyTitle) problems.Add($"Câu trả lời mẫu {i + 1}: tên tối đa {MaxReplyTitle} ký tự.");
            if (r.Body.Length > MaxBody) problems.Add($"Câu trả lời mẫu {i + 1}: nội dung tối đa {MaxBody} ký tự.");
        }
        if (s.DailyLimit is < 1 or > 50) problems.Add("Số góp ý mỗi ngày phải từ 1 đến 50.");
        if (s.AutoCloseDays is < 1 or > 365) problems.Add("Số ngày tự đóng phải từ 1 đến 365.");
        return problems;
    }

    public static string Subject(string body)
    {
        var line = body.Trim().Split('\n', 2)[0].Trim();
        return line.Length <= SubjectLength ? line : line[..(SubjectLength - 1)].TrimEnd() + "…";
    }
}

/// <summary>An image sent with a message, before it is stored.</summary>
public record FeedbackUpload(Stream Content, string FileName);

/// <param name="WordId">Set when reporting a word from a word card.</param>
public record CreateFeedbackRequest(string Category, string Body, string? WordId, string? AppVersion, string? Platform, string? Device);

public record FeedbackWordDto(string Id, string Text, string MeaningVi, string Level);

public record FeedbackMessageDto(Guid Id, bool FromAdmin, string? AuthorName, string Body, List<string> Images, DateTimeOffset CreatedAt);

public record FeedbackTicketSummaryDto(
    Guid Id,
    string Category,
    string Subject,
    string Status,
    bool Unread,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastMessageAt,
    string? WordText);

public record FeedbackTicketDto(
    Guid Id,
    string Category,
    string Subject,
    string Status,
    string? ClosedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastMessageAt,
    FeedbackWordDto? Word,
    List<FeedbackMessageDto> Messages);

public record FeedbackUnreadDto(int Count);

public class FeedbackException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>The learner's side: their own tickets only.</summary>
public interface IFeedbackService
{
    Task<List<FeedbackTicketSummaryDto>> ListAsync(Guid userId, CancellationToken ct = default);
    Task<FeedbackUnreadDto> UnreadAsync(Guid userId, CancellationToken ct = default);
    /// <summary>Also marks the admin's replies as read.</summary>
    Task<FeedbackTicketDto> GetAsync(Guid userId, Guid ticketId, CancellationToken ct = default);
    Task<FeedbackTicketDto> CreateAsync(Guid userId, CreateFeedbackRequest request, IReadOnlyList<FeedbackUpload> images, CancellationToken ct = default);
    Task<FeedbackTicketDto> ReplyAsync(Guid userId, Guid ticketId, string body, IReadOnlyList<FeedbackUpload> images, CancellationToken ct = default);
    Task<FeedbackTicketDto> ResolveAsync(Guid userId, Guid ticketId, CancellationToken ct = default);
    /// <summary>Removes stored screenshots before the account (and, by cascade, its tickets) is deleted.</summary>
    Task DeleteUserFilesAsync(Guid userId, CancellationToken ct = default);
}

/// <param name="Status">A status, or "active" (not closed) or "unread" (new learner messages).</param>
public record AdminFeedbackQuery(string? Status, string? Category, string? Q, int Page = 1, int PageSize = 30);

public record AdminFeedbackUserDto(Guid Id, string Email, string DisplayName);

public record AdminFeedbackSummaryDto(
    Guid Id,
    string Category,
    string Subject,
    string Status,
    bool Unread,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastMessageAt,
    int Messages,
    AdminFeedbackUserDto User,
    string? WordText);

public record AdminFeedbackCountsDto(int Open, int Answered, int Closed, int Unread);

public record AdminFeedbackPageDto(List<AdminFeedbackSummaryDto> Items, int Total, AdminFeedbackCountsDto Counts);

public record AdminFeedbackTicketDto(
    Guid Id,
    string Category,
    string Subject,
    string Status,
    string? ClosedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastMessageAt,
    string? AppVersion,
    string? Platform,
    string? Device,
    AdminFeedbackUserDto User,
    FeedbackWordDto? Word,
    List<FeedbackMessageDto> Messages);

public record AdminFeedbackReplyRequest(string Body, bool Close = false);

public interface IAdminFeedbackService
{
    Task<AdminFeedbackPageDto> ListAsync(AdminFeedbackQuery query, CancellationToken ct = default);
    Task<AdminFeedbackCountsDto> CountsAsync(CancellationToken ct = default);
    /// <summary>Also marks the learner's messages as read.</summary>
    Task<AdminFeedbackTicketDto> GetAsync(Guid ticketId, CancellationToken ct = default);
    Task<AdminFeedbackTicketDto> ReplyAsync(
        Guid ticketId, AdminFeedbackReplyRequest request, IReadOnlyList<FeedbackUpload> images, CancellationToken ct = default);
    Task<AdminFeedbackTicketDto> SetClosedAsync(Guid ticketId, bool closed, CancellationToken ct = default);
}

public interface IFeedbackSettingsService
{
    /// <summary>Stored settings, or <see cref="FeedbackSettings.Default"/>.</summary>
    Task<FeedbackSettings> GetAsync(CancellationToken ct = default);
}
