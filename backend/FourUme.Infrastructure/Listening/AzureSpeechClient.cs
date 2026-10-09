using System.Net;
using System.Security;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Listening;

public class SpeechOptions
{
    public const string SectionName = "Speech";
    /// <summary>Azure "Speech service" key (Keys and Endpoint → Key 1).</summary>
    public string? Key { get; set; }
    /// <summary>Region of the resource, e.g. southeastasia.</summary>
    public string? Region { get; set; }
    /// <summary>The free tier (F0) covers 500,000 characters per month.</summary>
    public int MonthlyCharLimit { get; set; } = 500_000;
    /// <summary>F0 allows 20 transactions per 60 seconds.</summary>
    public int RequestsPerMinute { get; set; } = 20;

    public bool Configured => !string.IsNullOrWhiteSpace(Key) && !string.IsNullOrWhiteSpace(Region);
}

/// <summary>
/// Text-to-speech over the Azure REST API (one request per sentence). Requests are spaced to stay under the
/// tier's per-minute limit, and 429 answers are retried after the delay the service asks for.
/// </summary>
public sealed class AzureSpeechClient(IHttpClientFactory httpFactory, IOptions<SpeechOptions> options, ILogger<AzureSpeechClient> logger)
{
    public const string HttpClientName = "azure-speech";
    private const string OutputFormat = "audio-24khz-48kbitrate-mono-mp3";
    /// <summary>Pause after each sentence, inside the generated audio.</summary>
    public const int PauseMs = 450;

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Queue<DateTimeOffset> _recent = new();

    public SpeechOptions Options => options.Value;

    /// <summary>Approximate billed characters for one sentence (text plus the prosody/break markup).</summary>
    public static int BilledChars(string text) => text.Trim().Length + 60;

    public async Task<byte[]> SynthesizeAsync(string voice, string text, string rate, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.Configured) throw new InvalidOperationException("Chưa cấu hình Azure Speech (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).");

        var lang = voice.Length >= 5 ? voice[..5] : "en-US";
        var ssml = $"""
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{lang}"><voice name="{SecurityElement.Escape(voice)}"><prosody rate="{rate}">{SecurityElement.Escape(text.Trim())}</prosody><break time="{PauseMs}ms"/></voice></speak>
            """;

        for (var attempt = 1; ; attempt++)
        {
            await WaitForSlotAsync(o.RequestsPerMinute, ct);
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://{o.Region!.Trim()}.tts.speech.microsoft.com/cognitiveservices/v1")
            {
                Content = new StringContent(ssml, Encoding.UTF8, "application/ssml+xml"),
            };
            request.Headers.Add("Ocp-Apim-Subscription-Key", o.Key!.Trim());
            request.Headers.Add("X-Microsoft-OutputFormat", OutputFormat);
            request.Headers.UserAgent.ParseAdd("4UME/1.0");

            using var response = await httpFactory.CreateClient(HttpClientName).SendAsync(request, ct);
            if (response.IsSuccessStatusCode) return await response.Content.ReadAsByteArrayAsync(ct);

            if (response.StatusCode == HttpStatusCode.TooManyRequests && attempt < 6)
            {
                var wait = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(10 * attempt);
                logger.LogInformation("Azure Speech throttled; retrying in {Seconds}s", wait.TotalSeconds);
                await Task.Delay(wait, ct);
                continue;
            }

            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Azure Speech failed {Status}: {Body}", (int)response.StatusCode, body.Length > 300 ? body[..300] : body);
            throw new InvalidOperationException(response.StatusCode switch
            {
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "Azure Speech từ chối khoá (sai key hoặc sai vùng).",
                HttpStatusCode.TooManyRequests => "Azure Speech đang giới hạn lượt gọi, hãy thử lại sau ít phút.",
                HttpStatusCode.BadRequest => "Azure Speech không đọc được câu này (giọng hoặc nội dung không hợp lệ).",
                _ => $"Azure Speech lỗi {(int)response.StatusCode}.",
            });
        }
    }

    private async Task WaitForSlotAsync(int perMinute, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var window = TimeSpan.FromSeconds(61);
            while (_recent.Count > 0 && DateTimeOffset.UtcNow - _recent.Peek() > window) _recent.Dequeue();
            if (_recent.Count >= Math.Max(1, perMinute))
            {
                var wait = _recent.Peek() + window - DateTimeOffset.UtcNow;
                if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
                _recent.Dequeue();
            }
            _recent.Enqueue(DateTimeOffset.UtcNow);
        }
        finally
        {
            _gate.Release();
        }
    }
}
