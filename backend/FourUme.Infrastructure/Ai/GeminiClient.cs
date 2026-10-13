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

    public bool Configured => !string.IsNullOrWhiteSpace(ApiKey);
    public string ModelName => string.IsNullOrWhiteSpace(Model) ? DefaultModel : Model.Trim();
}

/// <summary>Calls Gemini with a response schema, so the reply is JSON in the requested shape.</summary>
public sealed class GeminiClient(IHttpClientFactory httpFactory, IOptions<GeminiOptions> options, ILogger<GeminiClient> logger)
{
    public const string HttpClientName = "gemini";

    /// <summary>Waits before retrying an overloaded / briefly failing Gemini; drafting has two calls inside the 120 s client timeout.</summary>
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5)];

    private static bool Transient(HttpStatusCode s) =>
        s is HttpStatusCode.ServiceUnavailable or HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout;

    public bool Configured => options.Value.Configured;
    public string ModelName => options.Value.ModelName;

    public async Task<string> GenerateJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct)
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
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(o.ModelName)}:generateContent";
        var client = httpFactory.CreateClient(HttpClientName);
        HttpStatusCode status;
        string text;
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
            if (response.IsSuccessStatusCode || !Transient(status) || attempt > RetryDelays.Length) break;
            logger.LogInformation("Gemini {Status}, retrying (attempt {Attempt})", (int)status, attempt);
            await Task.Delay(RetryDelays[attempt - 1], ct);
        }

        if ((int)status >= 400)
        {
            logger.LogWarning("Gemini failed {Status}: {Body}", (int)status, text.Length > 400 ? text[..400] : text);
            throw new InvalidOperationException(status switch
            {
                HttpStatusCode.ServiceUnavailable => "Gemini đang quá tải (lỗi phía Google), đã thử lại vài lần vẫn chưa được. Hãy bấm lại sau ít phút.",
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
        return reply;
    }

    public static JsonObject Str(string? description = null) =>
        description is null ? new() { ["type"] = "STRING" } : new() { ["type"] = "STRING", ["description"] = description };

    public static JsonArray Names(params string[] names) => new(names.Select(n => (JsonNode)n).ToArray());
}
