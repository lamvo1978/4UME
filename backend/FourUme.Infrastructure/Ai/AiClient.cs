using System.Text.Json.Nodes;
using FourUme.Application.Admin;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Ai;

/// <param name="Model">The model that actually answered, shown to the admin next to the draft.</param>
public sealed record AiReply(string Text, string Model);

/// <summary>
/// The drafting AI: Groq first when it has a key, Gemini when Groq has no key or fails (quota, overload, broken reply).
/// Mistral is only used when picked by name or listed in a grading order.
/// </summary>
public sealed class AiClient(GroqClient groq, GeminiClient gemini, MistralClient mistral, ILogger<AiClient> logger)
{
    public const string NotConfiguredMessage = "Chưa cấu hình AI trên máy chủ (GROQ_API_KEY hoặc GEMINI_API_KEY).";

    /// <summary>Gradings keep the free tiers' per-minute token budgets for more learners.</summary>
    private const int GradeOutputTokens = 4000;

    public bool Configured => groq.Configured || gemini.Configured;
    public string ModelName => groq.Configured ? groq.ModelName : gemini.ModelName;

    public IReadOnlyList<AiProviderDto> Providers =>
    [
        new(AiProviders.Groq, "Groq", groq.Configured, groq.ModelName),
        new(AiProviders.Gemini, "Gemini", gemini.Configured, gemini.ModelName),
        new(AiProviders.Mistral, "Mistral", mistral.Configured, mistral.ModelName),
    ];

    /// <summary>Providers for "Luyện viết với AI", with the models each tries.</summary>
    public IReadOnlyList<AiProviderDto> WritingProviders =>
    [
        new(AiProviders.Mistral, "Mistral", mistral.Configured, string.Join(", ", mistral.WritingModels)),
        new(AiProviders.Groq, "Groq", groq.Configured, string.Join(", ", groq.WritingModels)),
        new(AiProviders.Gemini, "Gemini", gemini.Configured, gemini.ModelName),
    ];

    public bool IsConfigured(string provider) => provider switch
    {
        AiProviders.Groq => groq.Configured,
        AiProviders.Gemini => gemini.Configured,
        AiProviders.Mistral => mistral.Configured,
        _ => false,
    };

    /// <param name="provider">Null or empty: Groq then Gemini as fallback. Otherwise only that provider, so the admin can compare them.</param>
    public async Task<AiReply> GenerateJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct, string? provider = null)
    {
        switch (provider?.Trim().ToLowerInvariant())
        {
            case null or "":
                break;
            case AiProviders.Groq:
                if (!groq.Configured) throw new InvalidOperationException("Chưa cấu hình Groq trên máy chủ (GROQ_API_KEY).");
                return await Call("Groq", () => groq.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);
            case AiProviders.Gemini:
                if (!gemini.Configured) throw new InvalidOperationException("Chưa cấu hình Gemini trên máy chủ (GEMINI_API_KEY).");
                return await Call("Gemini", () => gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);
            case AiProviders.Mistral:
                if (!mistral.Configured) throw new InvalidOperationException("Chưa cấu hình Mistral trên máy chủ (MISTRAL_API_KEY).");
                return await Call("Mistral", () => mistral.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);
            default:
                throw new InvalidOperationException("AI không hợp lệ.");
        }
        return await WithFallbackAsync(instructions, prompt, schema, temperature, false, ct);
    }

    /// <summary>A reply a learner is waiting for: the quick settings of each provider, Groq then Gemini.</summary>
    public Task<AiReply> ChatJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct) =>
        WithFallbackAsync(instructions, prompt, schema, temperature, true, ct);

    /// <summary>
    /// Grades a learner's text: each configured provider in <paramref name="providers"/> in turn, with its writing models,
    /// all within <paramref name="budget"/>. A provider that isn't the last gets at most two thirds of the time left,
    /// so a slow one still leaves time for the next.
    /// </summary>
    /// <param name="model">Only this model of a single provider (the admin's "Chấm thử").</param>
    public async Task<AiReply> GradeJsonAsync(IReadOnlyList<string> providers, string instructions, string prompt, JsonObject schema, double temperature,
        TimeSpan budget, CancellationToken ct, string? model = null)
    {
        var chain = providers.Where(IsConfigured).Distinct().ToList();
        if (chain.Count == 0) throw new InvalidOperationException("Chưa cấu hình AI chấm bài trên máy chủ (MISTRAL_API_KEY hoặc GROQ_API_KEY).");
        var deadline = DateTimeOffset.UtcNow + budget;
        var errors = new List<string>();
        for (var i = 0; i < chain.Count; i++)
        {
            var p = chain[i];
            var left = deadline - DateTimeOffset.UtcNow;
            if (left < TimeSpan.FromSeconds(5)) break;
            var perProvider = i == chain.Count - 1 ? left : left * 2 / 3;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(perProvider);
            IReadOnlyList<string>? models = string.IsNullOrWhiteSpace(model) ? null : [model.Trim()];
            try
            {
                return p switch
                {
                    AiProviders.Mistral => await Call("Mistral", () =>
                        mistral.GenerateJsonAsync(instructions, prompt, schema, temperature, timeout.Token, models ?? mistral.WritingModels, GradeOutputTokens), timeout.Token),
                    AiProviders.Groq => await Call("Groq", () =>
                        groq.GenerateJsonAsync(instructions, prompt, schema, temperature, timeout.Token, false, models ?? groq.WritingModels, GradeOutputTokens), timeout.Token),
                    _ => await Call("Gemini", () => gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, timeout.Token), timeout.Token),
                };
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Grading with {Provider} timed out", p);
                errors.Add($"{p}: quá {perProvider.TotalSeconds:0} giây.");
            }
            catch (InvalidOperationException ex) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Grading with {Provider} failed: {Message}", p, ex.Message);
                errors.Add($"{p}: {ex.Message}");
            }
        }
        throw new InvalidOperationException(string.Join(" ", errors));
    }

    private async Task<AiReply> WithFallbackAsync(string instructions, string prompt, JsonObject schema, double temperature, bool chat, CancellationToken ct)
    {
        if (!Configured) throw new InvalidOperationException(NotConfiguredMessage);
        if (!groq.Configured) return await Call("Gemini", () => gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct, chat), ct);
        if (!gemini.Configured) return await Call("Groq", () => groq.GenerateJsonAsync(instructions, prompt, schema, temperature, ct, chat), ct);

        string groqError;
        try
        {
            return await Call("Groq", () => groq.GenerateJsonAsync(instructions, prompt, schema, temperature, ct, chat), ct);
        }
        catch (InvalidOperationException ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Groq failed, falling back to Gemini: {Message}", ex.Message);
            groqError = ex.Message;
        }

        try
        {
            return await Call("Gemini", () => gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct, chat), ct);
        }
        catch (InvalidOperationException ex)
        {
            throw new InvalidOperationException($"Groq: {groqError} Gemini: {ex.Message}", ex);
        }
    }

    /// <summary>Turns timeouts and network errors into a message the admin can read instead of a 500.</summary>
    private static async Task<AiReply> Call(string provider, Func<Task<AiReply>> call, CancellationToken ct)
    {
        try
        {
            return await call();
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new InvalidOperationException($"{provider} trả lời quá lâu (quá 2 phút), hãy thử lại hoặc soạn ít câu hơn.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException($"Không kết nối được tới {provider}, hãy thử lại.", ex);
        }
    }
}
