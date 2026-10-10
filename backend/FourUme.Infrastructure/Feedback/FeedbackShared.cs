using System.Net;
using FourUme.Application.Abstractions;
using FourUme.Application.Feedback;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Email;
using FourUme.Infrastructure.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Feedback;

/// <summary>Pieces used by both the learner and the admin side.</summary>
public class FeedbackShared(
    IAppDbContext db,
    IFeedbackSettingsService settings,
    IEmailSender email,
    IOptions<MediaOptions> mediaOptions,
    IOptions<EmailOptions> emailOptions,
    ILogger<FeedbackShared> logger)
{
    public const string ImageFolder = "feedback";
    /// <summary>Screenshots keep enough resolution to read text in them.</summary>
    private const int ImageMaxSide = 1600;

    private readonly string _mediaFolder = Path.GetFullPath(mediaOptions.Value.Path);

    /// <summary>Answered tickets the learner left alone for the configured days are closed when anyone looks at the list.</summary>
    public async Task CloseStaleAsync(CancellationToken ct)
    {
        var days = (await settings.GetAsync(ct)).AutoCloseDays;
        var cutoff = DateTimeOffset.UtcNow.AddDays(-days);
        var now = DateTimeOffset.UtcNow;
        await db.FeedbackTickets
            .Where(t => t.Status == FeedbackStatuses.Answered && t.LastMessageAt < cutoff)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, FeedbackStatuses.Closed)
                .SetProperty(t => t.ClosedAt, now)
                .SetProperty(t => t.ClosedBy, "auto"), ct);
    }

    public async Task<FeedbackWordDto?> WordAsync(string? wordId, CancellationToken ct) =>
        wordId is null
            ? null
            : await db.Words.AsNoTracking()
                .Where(w => w.Id == wordId)
                .Select(w => new FeedbackWordDto(w.Id, w.Text, w.MeaningVi, w.Level))
                .FirstOrDefaultAsync(ct);

    public static FeedbackMessageDto ToDto(FeedbackMessage m) => new(m.Id, m.FromAdmin, m.AuthorName, m.Body, m.Images, m.CreatedAt);

    public static string CleanBody(string? body)
    {
        var text = (body ?? "").Replace("\r\n", "\n").Trim();
        if (text.Length == 0) throw new FeedbackException(400, "Bạn chưa nhập nội dung.");
        if (text.Length > FeedbackRules.MaxBody) throw new FeedbackException(400, $"Nội dung tối đa {FeedbackRules.MaxBody} ký tự.");
        return text;
    }

    public List<string> SaveImages(IReadOnlyList<FeedbackUpload> images)
    {
        if (images.Count > FeedbackRules.MaxImages) throw new FeedbackException(400, $"Tối đa {FeedbackRules.MaxImages} ảnh mỗi lần gửi.");
        var urls = new List<string>();
        try
        {
            foreach (var image in images)
            {
                urls.Add(MediaStorage.SaveImage(image.Content, _mediaFolder, squareCrop: false, ImageMaxSide, ImageFolder).Url);
            }
        }
        catch (InvalidOperationException ex)
        {
            DeleteImages(urls);
            throw new FeedbackException(400, ex.Message);
        }
        return urls;
    }

    public void DeleteImages(IEnumerable<string> urls)
    {
        foreach (var url in urls)
        {
            MediaStorage.Delete(Path.Combine(_mediaFolder, ImageFolder), Path.GetFileName(url));
        }
    }

    /// <summary>Emails the configured recipients; failures are logged, never shown to the learner.</summary>
    public async Task NotifyStaffAsync(FeedbackTicket ticket, User user, FeedbackMessage message, bool isNew, CancellationToken ct)
    {
        var recipients = (await settings.GetAsync(ct)).Recipients;
        if (recipients.Count == 0) return;

        var link = $"{emailOptions.Value.AdminUrl.TrimEnd('/')}/feedback/{ticket.Id}";
        var category = FeedbackCategories.Label(ticket.Category);
        var who = string.IsNullOrWhiteSpace(user.DisplayName) ? user.Email : $"{user.DisplayName} ({user.Email})";
        var word = await WordAsync(ticket.WordId, ct);
        var subject = isNew ? $"[4UME] {category}: {ticket.Subject}" : $"[4UME] Trả lời thêm: {ticket.Subject}";

        var details = new List<string> { $"Người gửi: {who}", $"Loại: {category}" };
        if (word is not null) details.Add($"Từ: {word.Text} ({word.Level}) — {word.MeaningVi}");
        if (ticket.AppVersion is not null || ticket.Platform is not null)
            details.Add($"Máy: {string.Join(" · ", new[] { ticket.Platform, ticket.Device, ticket.AppVersion is null ? null : $"app {ticket.AppVersion}" }.Where(x => !string.IsNullOrWhiteSpace(x)))}");
        if (message.Images.Count > 0) details.Add($"Ảnh đính kèm: {message.Images.Count}");

        var text = $"{string.Join("\n", details)}\n\n{message.Body}\n\nTrả lời trên web admin: {link}";
        var html =
            $"<div style=\"font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#1A2E28\">" +
            $"<p style=\"color:#5C726A;margin:0 0 12px\">{string.Join("<br>", details.Select(WebUtility.HtmlEncode))}</p>" +
            $"<div style=\"white-space:pre-wrap;padding:12px 14px;border-radius:12px;background:#F2F7F5\">{WebUtility.HtmlEncode(message.Body)}</div>" +
            $"<p style=\"margin:16px 0 0\"><a href=\"{link}\" style=\"display:inline-block;padding:10px 16px;border-radius:10px;background:#0F6B5C;color:#fff;text-decoration:none;font-weight:600\">Trả lời trên web admin</a></p>" +
            "</div>";

        foreach (var to in recipients)
        {
            try
            {
                await email.SendAsync(new EmailMessage(to, subject, html, text), ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Feedback email to {To} failed for ticket {Ticket}", to, ticket.Id);
            }
        }
    }
}
