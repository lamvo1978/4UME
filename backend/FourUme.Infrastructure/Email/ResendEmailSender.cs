using System.Net.Http.Headers;
using System.Net.Http.Json;
using FourUme.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Email;

public class EmailOptions
{
    public const string SectionName = "Email";
    public string? ResendKey { get; set; }
    public string From { get; set; } = "4UME <noreply@4ume.io.vn>";
    public string? ReplyTo { get; set; }
}

/// <summary>
/// Sends through the Resend HTTP API. Without a key (local development) the mail is only logged,
/// so codes can be read from the API logs.
/// </summary>
public class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options, ILogger<ResendEmailSender> logger) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ResendKey))
        {
            logger.LogWarning("Email:ResendKey is not set; mail to {To} not sent. Subject: {Subject}\n{Text}",
                message.To, message.Subject, message.Text);
            return;
        }

        var payload = new Dictionary<string, object>
        {
            ["from"] = _options.From,
            ["to"] = new[] { message.To },
            ["subject"] = message.Subject,
            ["html"] = message.Html,
            ["text"] = message.Text,
        };
        if (!string.IsNullOrWhiteSpace(_options.ReplyTo)) payload["reply_to"] = _options.ReplyTo;

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ResendKey);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Resend request failed");
            throw new InvalidOperationException("Không gửi được email lúc này, vui lòng thử lại sau.");
        }

        using (response)
        {
            if (response.IsSuccessStatusCode) return;
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Resend rejected mail to {To}: {Status} {Body}", message.To, (int)response.StatusCode, body);
            throw new InvalidOperationException("Không gửi được email lúc này, vui lòng thử lại sau.");
        }
    }
}
