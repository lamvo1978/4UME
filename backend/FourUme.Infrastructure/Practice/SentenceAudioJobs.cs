using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Practice;

/// <summary>
/// Makes one mp3 per practice sentence in the background, one run at a time. Progress lives in memory only;
/// a sentence saved before a restart keeps its audio, the rest show as missing again.
/// </summary>
public sealed class SentenceAudioJobs(
    IServiceScopeFactory scopes,
    AzureSpeechClient speech,
    ListeningAudioJobs listeningJobs,
    IOptions<MediaOptions> media,
    IHostApplicationLifetime lifetime,
    ILogger<SentenceAudioJobs> logger)
{
    public const string Folder = "sentences";

    /// <summary>Voices alternate so a round doesn't sound like one person reading a list.</summary>
    private static readonly string[] VoiceCycle = ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural", "en-US-DavisNeural"];

    public sealed class Job
    {
        public int Done { get; set; }
        public int Total { get; init; }
        public bool Running { get; set; } = true;
        public string? Error { get; set; }
    }

    private readonly object _lock = new();
    public Job? Current { get; private set; }

    public Job Start(IReadOnlyList<Guid> ids)
    {
        lock (_lock)
        {
            if (Current is { Running: true }) throw new InvalidOperationException("Đang tạo giọng đọc, đợi xong lượt này nhé.");
            var job = new Job { Total = ids.Count };
            Current = job;
            _ = Task.Run(() => RunAsync(ids, job, lifetime.ApplicationStopping));
            return job;
        }
    }

    private async Task RunAsync(IReadOnlyList<Guid> ids, Job job, CancellationToken ct)
    {
        var folder = Path.Combine(Path.GetFullPath(media.Value.Path), Folder);
        var billed = 0;
        try
        {
            Directory.CreateDirectory(folder);
            foreach (var (id, i) in ids.Select((id, i) => (id, i)))
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var sentence = await db.PracticeSentences.FirstOrDefaultAsync(s => s.Id == id, ct);
                if (sentence is null)
                {
                    job.Done++;
                    continue;
                }

                var voice = sentence.Voice ?? VoiceCycle[i % VoiceCycle.Length];
                var text = sentence.En;
                var bytes = await speech.SynthesizeAsync(voice, text, ListeningRules.SpeakingRate(sentence.Level), ct);
                billed += AzureSpeechClient.BilledChars(text);
                var (frames, ms) = Mp3Frames.Clean(bytes);
                if (ms == 0) throw new InvalidOperationException("Azure Speech trả về âm thanh rỗng.");

                var fileName = $"{sentence.Id:N}-{Guid.NewGuid():N}.mp3";
                await File.WriteAllBytesAsync(Path.Combine(folder, fileName), frames, ct);
                var oldUrl = sentence.AudioUrl;
                sentence.Voice = voice;
                sentence.AudioUrl = $"{MediaOptions.UrlPrefix}/{Folder}/{fileName}";
                sentence.AudioText = text;
                await db.SaveChangesAsync(ct);
                DeleteAudio(oldUrl);
                job.Done++;
            }
            logger.LogInformation("Sentence audio: {Count} sentences", job.Done);
        }
        catch (Exception ex)
        {
            job.Error = ex is InvalidOperationException ? ex.Message : "Tạo giọng đọc thất bại, xem log của API.";
            if (ex is not InvalidOperationException) logger.LogError(ex, "Sentence audio failed");
        }
        finally
        {
            job.Running = false;
            if (billed > 0) await listeningJobs.AddUsageAsync(billed);
        }
    }

    public void DeleteAudio(string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        var path = Path.Combine(Path.GetFullPath(media.Value.Path), Folder, Path.GetFileName(url));
        if (File.Exists(path)) File.Delete(path);
    }
}
