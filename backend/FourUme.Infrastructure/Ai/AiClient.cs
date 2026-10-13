using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Ai;

/// <param name="Model">The model that actually answered, shown to the admin next to the draft.</param>
public sealed record AiReply(string Text, string Model);

/// <summary>
/// The drafting AI: Groq first when it has a key, Gemini when Groq has no key or fails (quota, overload, broken reply).
/// </summary>
public sealed class AiClient(GroqClient groq, GeminiClient gemini, ILogger<AiClient> logger)
{
    public const string NotConfiguredMessage = "Chưa cấu hình AI trên máy chủ (GROQ_API_KEY hoặc GEMINI_API_KEY).";

    public bool Configured => groq.Configured || gemini.Configured;
    public string ModelName => groq.Configured ? groq.ModelName : gemini.ModelName;

    public async Task<AiReply> GenerateJsonAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct)
    {
        if (!Configured) throw new InvalidOperationException(NotConfiguredMessage);
        if (!groq.Configured) return await Call("Gemini", () => gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);
        if (!gemini.Configured) return await Call("Groq", () => groq.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);

        string groqError;
        try
        {
            return await Call("Groq", () => groq.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);
        }
        catch (InvalidOperationException ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Groq failed, falling back to Gemini: {Message}", ex.Message);
            groqError = ex.Message;
        }

        try
        {
            return await Call("Gemini", () => gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct), ct);
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
