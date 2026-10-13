using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Ai;

public class GroqOptions
{
    public const string SectionName = "Groq";
    public const string DefaultModel = "llama-3.3-70b-versatile";
    /// <summary>console.groq.com → API Keys; the free tier is enough for drafting.</summary>
    public string? ApiKey { get; set; }
    public string? Model { get; set; }
    /// <summary>Comma-separated models tried in order when <see cref="Model"/> is out of quota or overloaded; unknown names are skipped.</summary>
    public string? FallbackModels { get; set; }
    public const string DefaultFallbackModels = "meta-llama/llama-4-scout-17b-16e-instruct";

    public bool Configured => !string.IsNullOrWhiteSpace(ApiKey);
    public string ModelName => string.IsNullOrWhiteSpace(Model) ? DefaultModel : Model.Trim();

    public IReadOnlyList<string> Models =>
        new[] { ModelName }
            .Concat((string.IsNullOrWhiteSpace(FallbackModels) ? DefaultFallbackModels : FallbackModels)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}

/// <summary>
/// Calls Groq's OpenAI-compatible chat API in JSON mode. Groq has no Gemini-style response schema for these models,
/// so the schema goes into the system message and the caller validates the reply as usual.
/// </summary>
public sealed class GroqClient(IHttpClientFactory httpFactory, IOptions<GroqOptions> options, ILogger<GroqClient> logger)
{
    public const string HttpClientName = "groq";
    private const string Url = "https://api.groq.com/openai/v1/chat/completions";

    /// <summary>
    /// The free tier counts prompt + max output against tokens per minute, so a large cap gets the request refused
    /// before it runs; 6000 is enough for 20 questions with every field.
    /// </summary>
    private const int MaxOutputTokens = 6000;

    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(3);

    private static bool Transient(HttpStatusCode s) =>
        s is HttpStatusCode.ServiceUnavailable or HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout;

    public bool Configured => options.Value.Configured;
    public string ModelName => options.Value.ModelName;

    public async Task<AiReply> GenerateJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.Configured) throw new InvalidOperationException("Chưa cấu hình Groq (GROQ_API_KEY) trên máy chủ.");

        var system = instructions.TrimEnd() + "\n\nReply with one JSON object only, no other text. It must match this JSON schema, " +
                     "with every property listed in \"required\" present:\n" + ToJsonSchema(schema).ToJsonString();
        var client = httpFactory.CreateClient(HttpClientName);
        var models = o.Models;
        var quotaHit = false;
        var overloaded = false;
        HttpStatusCode status = default;
        string text = "";
        for (var m = 0; m < models.Count; m++)
        {
            var payload = new JsonObject
            {
                ["model"] = models[m],
                ["messages"] = new JsonArray(
                    new JsonObject { ["role"] = "system", ["content"] = system },
                    new JsonObject { ["role"] = "user", ["content"] = prompt }),
                ["temperature"] = temperature,
                ["max_completion_tokens"] = MaxOutputTokens,
                ["response_format"] = new JsonObject { ["type"] = "json_object" },
            }.ToJsonString();

            for (var attempt = 1; ; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, Url)
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json"),
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", o.ApiKey!.Trim());
                using var response = await client.SendAsync(request, ct);
                status = response.StatusCode;
                text = await response.Content.ReadAsStringAsync(ct);
                if (response.IsSuccessStatusCode || !Transient(status) || attempt > 1) break;
                logger.LogInformation("Groq {Model} {Status}, retrying", models[m], (int)status);
                await Task.Delay(RetryDelay, ct);
            }

            if ((int)status is >= 200 and < 300)
            {
                var json = JsonNode.Parse(text);
                var choice = json?["choices"]?[0];
                var reply = choice?["message"]?["content"]?.GetValue<string>();
                if (choice?["finish_reason"]?.GetValue<string>() == "length")
                    throw new InvalidOperationException("Câu trả lời của AI bị cắt giữa chừng, hãy giảm số câu rồi soạn lại.");
                if (!string.IsNullOrWhiteSpace(reply)) return new AiReply(reply, models[m]);
                logger.LogWarning("Groq {Model} returned no text", models[m]);
                if (m == models.Count - 1) throw new InvalidOperationException("Groq không trả về nội dung, hãy thử lại.");
                continue;
            }

            if (status == HttpStatusCode.TooManyRequests) quotaHit = true;
            else if (Transient(status)) overloaded = true;
            // 413: prompt + output cap is over this model's per-minute token limit; 400 json_validate_failed: the model broke JSON mode;
            // 404 / decommissioned: the model is gone. Each of these may work on the next model.
            var tryNext = Transient(status) || status is HttpStatusCode.TooManyRequests or HttpStatusCode.RequestEntityTooLarge or HttpStatusCode.NotFound
                          || (status == HttpStatusCode.BadRequest && (text.Contains("json_validate_failed") || text.Contains("model_decommissioned") || text.Contains("model_not_found")));
            if (!tryNext || m == models.Count - 1) break;
            logger.LogWarning("Groq {Model} failed {Status}, trying {Next}", models[m], (int)status, models[m + 1]);
        }

        logger.LogWarning("Groq failed {Status}: {Body}", (int)status, text.Length > 1500 ? text[..1500] : text);
        throw new InvalidOperationException(status switch
        {
            _ when quotaHit && status is HttpStatusCode.TooManyRequests or HttpStatusCode.RequestEntityTooLarge =>
                "Đã hết lượt gọi Groq miễn phí (theo phút hoặc theo ngày) của các model. Hãy thử lại sau ít phút, hoặc soạn ít câu hơn.",
            HttpStatusCode.TooManyRequests => "Groq đang giới hạn lượt gọi của gói miễn phí, hãy thử lại sau khoảng 1 phút.",
            HttpStatusCode.RequestEntityTooLarge => "Yêu cầu quá dài so với giới hạn gói miễn phí của Groq, hãy soạn ít câu hơn.",
            _ when overloaded => "Groq đang quá tải, hãy bấm lại sau ít phút.",
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "Groq từ chối khoá (GROQ_API_KEY không đúng).",
            HttpStatusCode.BadRequest when text.Contains("json_validate_failed") => "AI trả về dữ liệu không đúng khuôn, hãy bấm soạn lại.",
            HttpStatusCode.NotFound or HttpStatusCode.BadRequest when text.Contains("model") =>
                $"Groq không có model \"{o.ModelName}\" (đổi GROQ_MODEL).",
            _ => $"Groq lỗi {(int)status}, hãy thử lại.",
        });
    }

    /// <summary>The shared schemas use Gemini's upper-case type names; plain JSON Schema wants lower case.</summary>
    private static JsonNode ToJsonSchema(JsonNode node) => node switch
    {
        JsonObject obj => new JsonObject(obj.Select(p => KeyValuePair.Create(p.Key,
            p.Key == "type" && p.Value is JsonValue v && v.TryGetValue<string>(out var t)
                ? JsonValue.Create(t.ToLowerInvariant())
                : p.Value is null ? null : ToJsonSchema(p.Value)))),
        JsonArray arr => new JsonArray(arr.Select(i => i is null ? null : ToJsonSchema(i)).ToArray()),
        _ => node.DeepClone(),
    };
}
