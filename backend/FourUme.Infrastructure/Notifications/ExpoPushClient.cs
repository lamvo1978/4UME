using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FourUme.Application.Notifications;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Notifications;

public class PushOptions
{
    public const string SectionName = "Push";

    /// <summary>Only needed once "Enhanced security for push notifications" is turned on in the Expo project.</summary>
    public string? ExpoAccessToken { get; set; }

    /// <summary>Turns the 5-minute job (weekly summary, long-absence reminders) on or off.</summary>
    public bool SchedulerEnabled { get; set; } = true;
}

/// <param name="Unregistered">The app was removed or the token expired; the token should be deleted.</param>
public record PushTicket(bool Ok, string? Error, bool Unregistered);

/// <summary>Expo push service: forwards to APNs (iOS) and FCM (Android) using the credentials stored in EAS.</summary>
public class ExpoPushClient(IHttpClientFactory http, IOptions<PushOptions> options, ILogger<ExpoPushClient> logger)
{
    public const string HttpClientName = "expo-push";
    private const string Url = "https://exp.host/--/api/v2/push/send";

    /// <summary>One ticket per token, in the same order.</summary>
    public async Task<IReadOnlyList<PushTicket>> SendAsync(IReadOnlyList<string> tokens, PushMessage message, CancellationToken ct)
    {
        var payload = tokens.Select(token => new
        {
            to = token,
            title = message.Title,
            body = message.Body,
            data = message.Data,
            sound = "default",
            priority = "high",
            // Created by the app ("Tin từ 4UME") before it registers a token; Android drops pushes to a missing channel.
            channelId = "default",
        });
        using var request = new HttpRequestMessage(HttpMethod.Post, Url) { Content = JsonContent.Create(payload) };
        if (!string.IsNullOrWhiteSpace(options.Value.ExpoAccessToken))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ExpoAccessToken);

        try
        {
            using var response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
            var text = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Expo push failed with {Status}: {Body}", (int)response.StatusCode, text);
                return tokens.Select(_ => new PushTicket(false, $"Expo trả lỗi {(int)response.StatusCode}", false)).ToList();
            }

            using var doc = JsonDocument.Parse(text);
            var tickets = doc.RootElement.GetProperty("data").EnumerateArray().Select(t =>
            {
                if (t.GetProperty("status").GetString() == "ok") return new PushTicket(true, null, false);
                var error = t.TryGetProperty("details", out var d) && d.TryGetProperty("error", out var e) ? e.GetString() : null;
                var detail = t.TryGetProperty("message", out var m) ? m.GetString() : null;
                return new PushTicket(false, error ?? detail ?? "Lỗi không rõ", error == "DeviceNotRegistered");
            }).ToList();
            return tickets.Count == tokens.Count ? tickets : tokens.Select(_ => new PushTicket(false, "Expo trả về không khớp", false)).ToList();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            if (ct.IsCancellationRequested) throw;
            logger.LogWarning(ex, "Expo push request failed");
            return tokens.Select(_ => new PushTicket(false, "Không kết nối được Expo", false)).ToList();
        }
    }
}
