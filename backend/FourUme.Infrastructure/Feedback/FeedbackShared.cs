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
        var name = string.IsNullOrWhiteSpace(user.DisplayName) ? null : user.DisplayName;
        var word = await WordAsync(ticket.WordId, ct);
        var subject = isNew ? $"[4UME] {category}: {ticket.Subject}" : $"[4UME] Trả lời thêm: {ticket.Subject}";

        var rows = new List<(string Label, string Value)>
        {
            ("Người gửi", name is null ? user.Email : $"{name} · {user.Email}"),
        };
        if (word is not null) rows.Add(("Từ", $"{word.Text} ({word.Level}) — {word.MeaningVi}"));
        var device = string.Join(" · ", new[] { ticket.Device, PlatformLabel(ticket.Platform) }.Where(x => !string.IsNullOrWhiteSpace(x)));
        if (device.Length > 0) rows.Add(("Thiết bị", device));
        if (ticket.AppVersion is not null) rows.Add(("Phiên bản", ticket.AppVersion));

        var images = message.Images.Select(url => url.StartsWith("http") ? url : $"{emailOptions.Value.ApiUrl.TrimEnd('/')}{url}").ToList();
        var text =
            $"{(isNew ? "Góp ý mới" : "Trả lời thêm")} · {category}\n" +
            string.Join("\n", rows.Select(r => $"{r.Label}: {r.Value}")) +
            $"\n\n{message.Body}\n" +
            (images.Count > 0 ? $"\nẢnh đính kèm:\n{string.Join("\n", images)}\n" : "") +
            $"\nTrả lời trên web admin: {link}";
        var html = StaffHtml(isNew ? "Góp ý mới" : "Trả lời thêm", category, ticket.Subject, rows, message.Body, images, link);

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

    /// <summary>"ios 27.0.1" → "iOS 27.0.1".</summary>
    private static string? PlatformLabel(string? platform)
    {
        if (string.IsNullOrWhiteSpace(platform)) return null;
        var parts = platform.Trim().Split(' ', 2);
        var os = parts[0].ToLowerInvariant() switch
        {
            "ios" => "iOS",
            "android" => "Android",
            "web" => "Web",
            _ => parts[0],
        };
        return parts.Length > 1 ? $"{os} {parts[1]}" : os;
    }

    /// <summary>Table layout with inline styles so it renders the same in Gmail, Outlook and Apple Mail.</summary>
    private static string StaffHtml(
        string heading,
        string category,
        string subject,
        IEnumerable<(string Label, string Value)> rows,
        string body,
        IReadOnlyList<string> images,
        string link)
    {
        static string E(string s) => WebUtility.HtmlEncode(s);
        const string font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

        var details = string.Concat(rows.Select(r =>
            $"<tr><td style=\"padding:6px 0;width:96px;color:#7A8C85;font-size:13px;vertical-align:top\">{E(r.Label)}</td>" +
            $"<td style=\"padding:6px 0;color:#1A2E28;font-size:14px\">{E(r.Value)}</td></tr>"));

        var gallery = images.Count == 0
            ? ""
            : "<tr><td style=\"padding:20px 28px 0\">" +
              $"<div style=\"color:#7A8C85;font-size:13px;margin-bottom:8px\">Ảnh đính kèm ({images.Count})</div>" +
              string.Concat(images.Select(url =>
                  $"<a href=\"{E(url)}\" style=\"display:inline-block;margin:0 8px 8px 0\">" +
                  $"<img src=\"{E(url)}\" width=\"120\" alt=\"Ảnh đính kèm\" style=\"display:block;width:120px;height:auto;border-radius:10px;border:1px solid #DCE8E3\"></a>")) +
              "</td></tr>";

        return
            $"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#EEF4F1;{font}\">" +
            "<tr><td align=\"center\" style=\"padding:24px 12px\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden\">" +
            "<tr><td style=\"background:#0F6B5C;padding:18px 28px\">" +
            $"<span style=\"color:#FFFFFF;font-size:20px;font-weight:700\">4UME</span>" +
            $"<span style=\"color:#BFE3D8;font-size:14px;margin-left:10px\">{E(heading)}</span>" +
            "</td></tr>" +
            "<tr><td style=\"padding:24px 28px 0\">" +
            $"<span style=\"display:inline-block;padding:4px 10px;border-radius:999px;background:#FFF1E6;color:#D9620B;font-size:12px;font-weight:600\">{E(category)}</span>" +
            $"<div style=\"color:#1A2E28;font-size:18px;font-weight:700;margin-top:10px;line-height:1.35\">{E(subject)}</div>" +
            "</td></tr>" +
            $"<tr><td style=\"padding:14px 28px 0\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-top:1px solid #E6EEEA;border-bottom:1px solid #E6EEEA\">{details}</table></td></tr>" +
            "<tr><td style=\"padding:20px 28px 0\">" +
            $"<div style=\"white-space:pre-wrap;padding:14px 16px;border-radius:12px;background:#F2F7F5;border-left:4px solid #0F6B5C;color:#1A2E28;font-size:15px;line-height:1.5\">{E(body)}</div>" +
            "</td></tr>" +
            gallery +
            "<tr><td style=\"padding:24px 28px 28px\">" +
            $"<a href=\"{E(link)}\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#0F6B5C;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px\">Trả lời trên web admin</a>" +
            "</td></tr>" +
            "</table>" +
            "<div style=\"color:#8A978F;font-size:12px;margin-top:14px\">Email tự động từ 4UME · bạn nhận được vì có trong danh sách Email nhận góp ý</div>" +
            "</td></tr></table>";
    }
}
