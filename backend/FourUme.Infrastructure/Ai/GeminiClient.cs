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

        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(o.ModelName)}:generateContent")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-goog-api-key", o.ApiKey!.Trim());

        using var response = await httpFactory.CreateClient(HttpClientName).SendAsync(request, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Gemini failed {Status}: {Body}", (int)response.StatusCode, text.Length > 400 ? text[..400] : text);
            throw new InvalidOperationException(response.StatusCode switch
            {
                HttpStatusCode.TooManyRequests => "Gemini đang giới hạn lượt gọi của gói miễn phí, hãy thử lại sau khoảng 1 phút.",
                HttpStatusCode.BadRequest when text.Contains("API_KEY", StringComparison.OrdinalIgnoreCase) => "Gemini từ chối khoá (GEMINI_API_KEY không đúng).",
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "Gemini từ chối khoá (GEMINI_API_KEY không đúng hoặc chưa bật).",
                HttpStatusCode.NotFound => $"Gemini không có model \"{o.ModelName}\" (đổi GEMINI_MODEL).",
                _ => $"Gemini lỗi {(int)response.StatusCode}, hãy thử lại.",
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
