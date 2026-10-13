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
        if (!groq.Configured) return await gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct);

        string groqError;
        try
        {
            return await groq.GenerateJsonAsync(instructions, prompt, schema, temperature, ct);
        }
        catch (Exception ex) when (gemini.Configured && !ct.IsCancellationRequested
                                   && ex is InvalidOperationException or HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning("Groq failed, falling back to Gemini: {Message}", ex.Message);
            groqError = ex is InvalidOperationException ? ex.Message : "không kết nối được.";
        }

        try
        {
            return await gemini.GenerateJsonAsync(instructions, prompt, schema, temperature, ct);
        }
        catch (InvalidOperationException ex)
        {
            throw new InvalidOperationException($"Groq: {groqError} Gemini: {ex.Message}", ex);
        }
    }
}
