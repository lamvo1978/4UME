using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Ai;

public class MistralOptions
{
    public const string SectionName = "Mistral";
    /// <summary>
    /// Pinned versions. The free tier's Limits page lists the Large models but refuses them (403 tier_not_allowed),
    /// and Small / Medium answer 429 there; the Ministral models are what it actually serves.
    /// </summary>
    public const string DefaultModel = "ministral-14b-2512";
    public const string DefaultWritingModels = "ministral-14b-2512";
    /// <summary>
    /// console.mistral.ai → API keys. Free mode lets Mistral train on the requests unless
    /// Admin panel → Privacy → "Anonymous improvement data" is switched off.
    /// </summary>
    public string? ApiKey { get; set; }
    /// <summary>Model for admin drafts; empty uses <see cref="DefaultModel"/>.</summary>
    public string? Model { get; set; }
    /// <summary>Comma-separated models for "Luyện viết với AI", tried in order.</summary>
    public string? WritingModels { get; set; }

    public bool Configured => !string.IsNullOrWhiteSpace(ApiKey);
    public string ModelName => string.IsNullOrWhiteSpace(Model) ? DefaultModel : Model.Trim();

    public IReadOnlyList<string> WritingModelList =>
        (string.IsNullOrWhiteSpace(WritingModels) ? DefaultWritingModels : WritingModels)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}

/// <summary>
/// Calls Mistral's chat API with a strict JSON schema; a model that refuses the schema gets plain JSON mode
/// with the schema in the system message instead.
/// </summary>
public sealed class MistralClient(IHttpClientFactory httpFactory, IOptions<MistralOptions> options, ILogger<MistralClient> logger)
{
    public const string HttpClientName = "mistral";
    private const string Url = "https://api.mistral.ai/v1/chat/completions";
    private const int MaxOutputTokens = 6000;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(2);

    private static bool Transient(HttpStatusCode s) =>
        s is HttpStatusCode.ServiceUnavailable or HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout;

    public bool Configured => options.Value.Configured;
    public string ModelName => options.Value.ModelName;
    public IReadOnlyList<string> WritingModels => options.Value.WritingModelList;

    /// <param name="models">Models tried in order; null uses <see cref="MistralOptions.ModelName"/>.</param>
    public async Task<AiReply> GenerateJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct,
        IReadOnlyList<string>? models = null, int maxTokens = MaxOutputTokens)
    {
        var o = options.Value;
        if (!o.Configured) throw new InvalidOperationException("Chưa cấu hình Mistral (MISTRAL_API_KEY) trên máy chủ.");
        models ??= [o.ModelName];

        var strictSchema = ToStrictSchema(schema);
        var looseSystem = instructions.TrimEnd() + "\n\nReply with one JSON object only, no other text. It must match this JSON schema, " +
                          "with every property listed in \"required\" present:\n" + strictSchema.ToJsonString();
        var client = httpFactory.CreateClient(HttpClientName);
        var quotaHit = false;
        var overloaded = false;
        var tierBlocked = new List<string>();
        HttpStatusCode status = default;
        var text = "";
        for (var m = 0; m < models.Count; m++)
        {
            var strict = true;
            for (var attempt = 1; ; attempt++)
            {
                var body = new JsonObject
                {
                    ["model"] = models[m],
                    ["messages"] = new JsonArray(
                        new JsonObject { ["role"] = "system", ["content"] = strict ? instructions : looseSystem },
                        new JsonObject { ["role"] = "user", ["content"] = prompt }),
                    ["temperature"] = temperature,
                    ["max_tokens"] = maxTokens,
                    ["response_format"] = strict
                        ? new JsonObject
                        {
                            ["type"] = "json_schema",
                            ["json_schema"] = new JsonObject { ["name"] = "result", ["strict"] = true, ["schema"] = strictSchema.DeepClone() },
                        }
                        : new JsonObject { ["type"] = "json_object" },
                };
                using var request = new HttpRequestMessage(HttpMethod.Post, Url)
                {
                    Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", o.ApiKey!.Trim());
                using var response = await client.SendAsync(request, ct);
                status = response.StatusCode;
                text = await response.Content.ReadAsStringAsync(ct);
                if (strict && status is HttpStatusCode.BadRequest or HttpStatusCode.UnprocessableEntity
                           && (text.Contains("schema", StringComparison.OrdinalIgnoreCase) || text.Contains("response_format", StringComparison.OrdinalIgnoreCase)))
                {
                    logger.LogInformation("Mistral {Model} rejects the strict schema, using JSON mode", models[m]);
                    strict = false;
                    attempt--;
                    continue;
                }
                if (response.IsSuccessStatusCode || !Transient(status) || attempt > 1) break;
                logger.LogInformation("Mistral {Model} {Status}, retrying", models[m], (int)status);
                await Task.Delay(RetryDelay, ct);
            }

            if ((int)status is >= 200 and < 300)
            {
                var choice = JsonNode.Parse(text)?["choices"]?[0];
                var reply = ContentText(choice?["message"]?["content"]);
                if (choice?["finish_reason"]?.GetValue<string>() == "length")
                    throw new InvalidOperationException("Câu trả lời của AI bị cắt giữa chừng, hãy thử lại.");
                if (!string.IsNullOrWhiteSpace(reply)) return new AiReply(reply, models[m]);
                logger.LogWarning("Mistral {Model} returned no text", models[m]);
                if (m == models.Count - 1) throw new InvalidOperationException("Mistral không trả về nội dung, hãy thử lại.");
                continue;
            }

            if (status == HttpStatusCode.TooManyRequests) quotaHit = true;
            else if (Transient(status)) overloaded = true;
            // 403 tier_not_allowed: the plan doesn't include this model (the free tier lists more models than it serves).
            var notInTier = status == HttpStatusCode.Forbidden && text.Contains("tier_not_allowed", StringComparison.OrdinalIgnoreCase);
            if (notInTier) tierBlocked.Add(models[m]);
            var tryNext = Transient(status) || notInTier || status is HttpStatusCode.TooManyRequests or HttpStatusCode.NotFound
                          || (status == HttpStatusCode.BadRequest && text.Contains("model", StringComparison.OrdinalIgnoreCase));
            if (!tryNext || m == models.Count - 1) break;
            logger.LogWarning("Mistral {Model} failed {Status}, trying {Next}", models[m], (int)status, models[m + 1]);
        }

        logger.LogWarning("Mistral failed {Status}: {Body}", (int)status, text.Length > 1500 ? text[..1500] : text);
        var blocked = tierBlocked.Count > 0 ? $" Gói Mistral hiện tại không cho dùng {string.Join(", ", tierBlocked)} (đổi MISTRAL_WRITING_MODELS)." : "";
        throw new InvalidOperationException(status switch
        {
            HttpStatusCode.TooManyRequests when quotaHit => "Đã hết lượt gọi Mistral (theo phút hoặc theo tháng). Hãy thử lại sau ít phút." + blocked,
            _ when overloaded => "Mistral đang quá tải, hãy bấm lại sau ít phút." + blocked,
            HttpStatusCode.Forbidden when tierBlocked.Count > 0 => blocked.Trim(),
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "Mistral từ chối khoá (MISTRAL_API_KEY không đúng).",
            HttpStatusCode.NotFound or HttpStatusCode.BadRequest when text.Contains("model", StringComparison.OrdinalIgnoreCase) =>
                $"Mistral không có model \"{models[^1]}\" (đổi MISTRAL_WRITING_MODELS).",
            _ => $"Mistral lỗi {(int)status}, hãy thử lại.",
        });
    }

    /// <summary>Reasoning models answer with a list of chunks (thinking, then text); others with a plain string.</summary>
    private static string? ContentText(JsonNode? content) => content switch
    {
        JsonValue v when v.TryGetValue<string>(out var s) => s,
        JsonArray parts => string.Concat(parts.Select(p => p?["type"]?.GetValue<string>() == "text" ? p["text"]?.GetValue<string>() ?? "" : "")),
        _ => null,
    };

    /// <summary>
    /// The shared schemas use Gemini's upper-case type names; strict JSON Schema wants lower case, every property
    /// required and no extra properties.
    /// </summary>
    private static JsonObject ToStrictSchema(JsonObject node)
    {
        var result = new JsonObject();
        foreach (var (key, value) in node)
        {
            result[key] = key switch
            {
                "type" when value is JsonValue v && v.TryGetValue<string>(out var t) => t.ToLowerInvariant(),
                "properties" when value is JsonObject props => new JsonObject(props.Select(p =>
                    KeyValuePair.Create(p.Key, p.Value is JsonObject child ? (JsonNode)ToStrictSchema(child) : p.Value?.DeepClone()))),
                "items" when value is JsonObject item => ToStrictSchema(item),
                _ => value?.DeepClone(),
            };
        }
        if (result["properties"] is JsonObject properties)
        {
            result["required"] = new JsonArray(properties.Select(p => (JsonNode)p.Key).ToArray());
            result["additionalProperties"] = false;
        }
        return result;
    }
}
