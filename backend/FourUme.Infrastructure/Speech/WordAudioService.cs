using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Speech;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Speech;

/// <summary>
/// One mp3 per word and voice under /media/words, shared by every learner. Recordings are made on first request,
/// one at a time (the Azure free tier allows few requests per minute), and never for text outside the vocabulary.
/// </summary>
public sealed partial class WordAudioService(
    IAppDbContext db,
    AzureSpeechClient speech,
    ListeningAudioJobs usage,
    IOptions<MediaOptions> media,
    ILogger<WordAudioService> logger) : IWordAudioService
{
    public const string Folder = "words";
    private const string Rate = "-5%";
    /// <summary>A learner waiting for the first recording of a word gets the phone's voice instead after this.</summary>
    private static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(6);
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<WordAudioDto> GetAsync(string text, string voice, CancellationToken ct = default)
    {
        text = WhiteSpace().Replace((text ?? "").Trim(), " ");
        if (!WordVoices.Azure.TryGetValue(voice ?? "", out var azureVoice) || !Allowed().IsMatch(text)) return new(null);

        var fileName = FileName(text);
        var folder = Path.Combine(Path.GetFullPath(media.Value.Path), Folder, voice!);
        var url = $"{MediaOptions.UrlPrefix}/{Folder}/{voice}/{fileName}";
        if (File.Exists(Path.Combine(folder, fileName))) return new(url);

        if (!speech.Options.Configured) return new(null);
        if (!await db.Words.AsNoTracking().AnyAsync(w => EF.Functions.ILike(w.Text, text), ct)) return new(null);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(MaxWait);
        try
        {
            if (!await Gate.WaitAsync(MaxWait, ct)) return new(null);
        }
        catch (OperationCanceledException)
        {
            return new(null);
        }
        try
        {
            if (File.Exists(Path.Combine(folder, fileName))) return new(url);
            var billed = AzureSpeechClient.BilledChars(text);
            var month = await usage.GetUsageAsync(db, ct);
            if (month.Chars + billed > speech.Options.MonthlyCharLimit * WordVoices.MonthlyShare) return new(null);

            var bytes = await speech.SynthesizeAsync(azureVoice, text, Rate, timeout.Token);
            await usage.AddUsageAsync(billed);
            var (frames, ms) = Mp3Frames.Clean(bytes);
            if (ms == 0) return new(null);
            Directory.CreateDirectory(folder);
            var temp = Path.Combine(folder, $"{fileName}.{Guid.NewGuid():N}.tmp");
            await File.WriteAllBytesAsync(temp, frames, CancellationToken.None);
            File.Move(temp, Path.Combine(folder, fileName), overwrite: true);
            return new(url);
        }
        catch (Exception ex) when (ex is OperationCanceledException or InvalidOperationException or HttpRequestException)
        {
            if (ex is not OperationCanceledException) logger.LogWarning(ex, "Word audio for {Text} ({Voice}) failed", text, voice);
            return new(null);
        }
        finally
        {
            Gate.Release();
        }
    }

    /// <summary>Readable and case-insensitive; the hash keeps "its" and "it's" apart.</summary>
    private static string FileName(string text)
    {
        var lower = text.ToLowerInvariant();
        var slug = NonWord().Replace(lower, "-").Trim('-');
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(lower)))[..8];
        return $"{(slug.Length > 0 ? slug : "w")}-{hash}.mp3";
    }

    [GeneratedRegex(@"^[A-Za-z][A-Za-z '’.\-]{0,47}$")]
    private static partial Regex Allowed();

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex NonWord();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();
}
