using System.Net;
using System.Text;
using System.Text.Json;
using FourUme.Application.Pronunciation;
using FourUme.Infrastructure.Listening;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Pronunciation;

public record AzureAssessment(int Score, int Accuracy, int Fluency, int Completeness, string Heard, IReadOnlyList<WordScoreDto> Words);

/// <summary>Pronunciation assessment over Azure's speech-to-text REST API for short audio (same key as text-to-speech).</summary>
public sealed class AzurePronunciationClient(
    IHttpClientFactory httpFactory,
    IOptions<SpeechOptions> options,
    ILogger<AzurePronunciationClient> logger)
{
    public bool Configured => options.Value.Configured;

    /// <returns>Null when no speech was recognised (silence or noise).</returns>
    public async Task<AzureAssessment?> AssessAsync(byte[] wav, string referenceText, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.Configured) throw new PronunciationException(503, "Chưa cấu hình Azure Speech nên chưa chấm được phát âm.");

        var config = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["ReferenceText"] = referenceText,
            ["GradingSystem"] = "HundredMark",
            ["Granularity"] = "Phoneme",
            ["Dimension"] = "Comprehensive",
            ["EnableMiscue"] = false,
            ["PhonemeAlphabet"] = "IPA",
        });
        var url = $"https://{o.Region!.Trim()}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
                  + "?language=en-US&format=detailed";
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = new ByteArrayContent(wav) };
        // Azure's own format; "codecs=audio/pcm" isn't a valid token for the strict MediaTypeHeaderValue parser.
        request.Content.Headers.TryAddWithoutValidation("Content-Type", $"audio/wav; codecs=audio/pcm; samplerate={AudioConverter.SampleRate}");
        request.Headers.Add("Ocp-Apim-Subscription-Key", o.Key!.Trim());
        request.Headers.Add("Pronunciation-Assessment", Convert.ToBase64String(Encoding.UTF8.GetBytes(config)));

        using var response = await httpFactory.CreateClient(AzureSpeechClient.HttpClientName).SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Azure pronunciation failed {Status}: {Body}", (int)response.StatusCode, body.Length > 300 ? body[..300] : body);
            throw new PronunciationException(503, response.StatusCode switch
            {
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "Azure Speech từ chối khoá (sai key hoặc sai vùng).",
                HttpStatusCode.TooManyRequests => "Đang có nhiều người chấm cùng lúc, bạn thử lại sau vài giây nhé.",
                _ => $"Azure Speech lỗi {(int)response.StatusCode}.",
            });
        }
        return Parse(body);
    }

    public static AzureAssessment? Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (Str(root, "RecognitionStatus") != "Success") return null;
        if (!root.TryGetProperty("NBest", out var nbest) || nbest.GetArrayLength() == 0) return null;
        var best = nbest[0];
        // Newer API versions nest the scores under "PronunciationAssessment".
        var scores = best.TryGetProperty("PronunciationAssessment", out var pa) ? pa : best;

        var words = new List<WordScoreDto>();
        if (best.TryGetProperty("Words", out var ws))
        {
            foreach (var w in ws.EnumerateArray())
            {
                var wScores = w.TryGetProperty("PronunciationAssessment", out var wpa) ? wpa : w;
                var phonemes = new List<PhonemeScoreDto>();
                if (w.TryGetProperty("Phonemes", out var ps))
                {
                    foreach (var p in ps.EnumerateArray())
                    {
                        var pScores = p.TryGetProperty("PronunciationAssessment", out var ppa) ? ppa : p;
                        phonemes.Add(new PhonemeScoreDto(Str(p, "Phoneme") ?? "", Num(pScores, "AccuracyScore")));
                    }
                }
                words.Add(new WordScoreDto(Str(w, "Word") ?? "", Num(wScores, "AccuracyScore"), Str(wScores, "ErrorType") ?? "None", phonemes));
            }
        }

        return new AzureAssessment(
            Num(scores, "PronScore"),
            Num(scores, "AccuracyScore"),
            Num(scores, "FluencyScore"),
            Num(scores, "CompletenessScore"),
            Str(best, "Lexical") ?? Str(root, "DisplayText") ?? "",
            words);
    }

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static int Num(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? (int)Math.Round(v.GetDouble()) : 0;
}
