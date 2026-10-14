using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Ai;

public class GeminiOptions
{
    public const string SectionName = "Gemini";
    public const string DefaultModel = "gemini-flash-latest";
    /// <summary>Google AI Studio key (aistudio.google.com → Get API key); the free tier is enough for drafting.</summary>
    public string? ApiKey { get; set; }
    public string? Model { get; set; }
    /// <summary>Comma-separated models tried in order when <see cref="Model"/> stays overloaded; unknown names are skipped.</summary>
    public string? FallbackModels { get; set; }
    public const string DefaultFallbackModels = "gemini-flash-lite-latest,gemini-2.5-flash";

    public bool Configured => !string.IsNullOrWhiteSpace(ApiKey);
    public string ModelName => string.IsNullOrWhiteSpace(Model) ? DefaultModel : Model.Trim();

    public IReadOnlyList<string> Models =>
        new[] { ModelName }
            .Concat((string.IsNullOrWhiteSpace(FallbackModels) ? DefaultFallbackModels : FallbackModels)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}

/// <summary>Calls Gemini with a response schema, so the reply is JSON in the requested shape.</summary>
public sealed class GeminiClient(IHttpClientFactory httpFactory, IOptions<GeminiOptions> options, ILogger<GeminiClient> logger)
{
    public const string HttpClientName = "gemini";

    /// <summary>
    /// Waits before retrying an overloaded Gemini. Kept short: failed calls also count against the free-tier quota,
    /// so after this the next model is tried instead.
    /// </summary>
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(3)];

    private static bool Transient(HttpStatusCode s) =>
        s is HttpStatusCode.ServiceUnavailable or HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout;

    public bool Configured => options.Value.Configured;
    public string ModelName => options.Value.ModelName;

    public async Task<AiReply> GenerateJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.Configured) throw new InvalidOperationException("Chưa cấu hình Gemini (GEMINI_API_KEY) trên máy chủ.");

        var body = new JsonObject
        {
            ["systemInstruction"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = instructions }) },
            ["contents"] = new JsonArray(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray(new JsonObject { ["text"] = prompt }),
            }),
            ["generationConfig"] = new JsonObject
            {
                ["temperature"] = temperature,
                ["responseMimeType"] = "application/json",
                ["responseSchema"] = schema,
            },
        };

        var payload = body.ToJsonString();
        var client = httpFactory.CreateClient(HttpClientName);
        var models = o.Models;
        var overloaded = false;
        var quotaHit = false;
        HttpStatusCode status = default;
        string text = "";
        var used = models[0];
        for (var m = 0; m < models.Count; m++)
        {
            used = models[m];
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(models[m])}:generateContent";
            // The main model gets retries; a fallback is tried once, since it is only there for when the main one is overloaded.
            var retries = m == 0 ? RetryDelays.Length : 0;
            for (var attempt = 1; ; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json"),
                };
                request.Headers.Add("x-goog-api-key", o.ApiKey!.Trim());
                using var response = await client.SendAsync(request, ct);
                status = response.StatusCode;
                text = await response.Content.ReadAsStringAsync(ct);
                if (response.IsSuccessStatusCode || !Transient(status) || attempt > retries) break;
                logger.LogInformation("Gemini {Model} {Status}, retrying (attempt {Attempt})", models[m], (int)status, attempt);
                await Task.Delay(RetryDelays[attempt - 1], ct);
            }
            if ((int)status < 400) break;
            if (status == HttpStatusCode.TooManyRequests) quotaHit = true;
            else if (Transient(status)) overloaded = true;
            // Quotas are per model, so a model out of quota or overloaded hands over to the next one.
            var tryNext = Transient(status) || status == HttpStatusCode.TooManyRequests || (m > 0 && status == HttpStatusCode.NotFound);
            if (!tryNext || m == models.Count - 1) break;
            logger.LogWarning("Gemini {Model} failed {Status}, trying {Next}", models[m], (int)status, models[m + 1]);
        }

        if ((int)status >= 400)
        {
            logger.LogWarning("Gemini failed {Status}: {Body}", (int)status, text.Length > 1500 ? text[..1500] : text);
            var perDay = text.Contains("PerDay", StringComparison.OrdinalIgnoreCase);
            throw new InvalidOperationException(status switch
            {
                _ when quotaHit && (perDay || status != HttpStatusCode.TooManyRequests) =>
                    "Đã hết lượt gọi Gemini miễn phí trong ngày của các model (gói miễn phí chỉ vài chục lượt / ngày / model, mỗi lần soạn tốn 2 lượt). Hãy thử lại vào ngày mai hoặc bật thanh toán cho khoá Gemini.",
                _ when overloaded && (Transient(status) || status == HttpStatusCode.NotFound) =>
                    "Gemini đang quá tải (lỗi phía Google), đã thử cả model dự phòng vẫn chưa được. Hãy bấm lại sau ít phút.",
                HttpStatusCode.ServiceUnavailable => "Gemini đang quá tải (lỗi phía Google). Hãy bấm lại sau ít phút.",
                HttpStatusCode.TooManyRequests => "Gemini đang giới hạn lượt gọi của gói miễn phí, hãy thử lại sau khoảng 1 phút.",
                HttpStatusCode.BadRequest when text.Contains("API_KEY", StringComparison.OrdinalIgnoreCase) => "Gemini từ chối khoá (GEMINI_API_KEY không đúng).",
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "Gemini từ chối khoá (GEMINI_API_KEY không đúng hoặc chưa bật).",
                HttpStatusCode.NotFound => $"Gemini không có model \"{o.ModelName}\" (đổi GEMINI_MODEL).",
                _ => $"Gemini lỗi {(int)status}, hãy thử lại.",
            });
        }

        var json = JsonNode.Parse(text);
        var parts = json?["candidates"]?[0]?["content"]?["parts"]?.AsArray();
        var reply = parts is null ? null : string.Concat(parts.Select(p => p?["text"]?.GetValue<string>() ?? ""));
        if (string.IsNullOrWhiteSpace(reply))
        {
            var reason = json?["candidates"]?[0]?["finishReason"]?.GetValue<string>() ?? json?["promptFeedback"]?["blockReason"]?.GetValue<string>();
            logger.LogWarning("Gemini returned no text ({Reason})", reason);
            throw new InvalidOperationException("Gemini không trả về nội dung, hãy đổi yêu cầu hoặc thử lại.");
        }
        return new AiReply(reply, used);
    }

    public static JsonObject Str(string? description = null) =>
        description is null ? new() { ["type"] = "STRING" } : new() { ["type"] = "STRING", ["description"] = description };

    public static JsonArray Names(params string[] names) => new(names.Select(n => (JsonNode)n).ToArray());
}
