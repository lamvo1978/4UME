using FourUme.Application.Speech;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Speech;

/// <summary>
/// One mp3 per vocabulary example sentence, shared by every learner. Voices alternate female/male by catalog order.
/// </summary>
public sealed class ExampleAudioJobs(
    IServiceScopeFactory scopes,
    AzureSpeechClient speech,
    ListeningAudioJobs listeningJobs,
    IOptions<MediaOptions> media,
    IHostApplicationLifetime lifetime,
    ILogger<ExampleAudioJobs> logger)
{
    public const string Folder = "word-examples";
    private const string Rate = "-5%";
    private static readonly string[] VoiceCycle =
    [
        WordVoices.Azure[WordVoices.Female],
        WordVoices.Azure[WordVoices.Male],
    ];

    public sealed class Job
    {
        public int Done { get; set; }
        public int Total { get; init; }
        public bool Running { get; set; } = true;
        public string? Error { get; set; }
    }

    private readonly object _lock = new();
    public Job? Current { get; private set; }

    public Job Start(IReadOnlyList<string> wordIds, IReadOnlyDictionary<string, int> voiceRank)
    {
        lock (_lock)
        {
            if (Current is { Running: true }) throw new InvalidOperationException("Đang tạo giọng đọc câu ví dụ, đợi xong lượt này nhé.");
            var job = new Job { Total = wordIds.Count };
            Current = job;
            _ = Task.Run(() => RunAsync(wordIds, voiceRank, job, lifetime.ApplicationStopping));
            return job;
        }
    }

    private async Task RunAsync(IReadOnlyList<string> ids, IReadOnlyDictionary<string, int> voiceRank, Job job, CancellationToken ct)
    {
        var folder = Path.Combine(Path.GetFullPath(media.Value.Path), Folder);
        var billed = 0;
        try
        {
            Directory.CreateDirectory(folder);
            foreach (var id in ids)
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var word = await db.Words.FirstOrDefaultAsync(w => w.Id == id, ct);
                if (word is null || string.IsNullOrWhiteSpace(word.Example))
                {
                    job.Done++;
                    continue;
                }

                var text = word.Example.Trim();
                var rank = voiceRank.GetValueOrDefault(id, job.Done);
                var voice = VoiceCycle[rank % VoiceCycle.Length];
                var bytes = await speech.SynthesizeAsync(voice, text, Rate, ct);
                billed += AzureSpeechClient.BilledChars(text);
                var (frames, ms) = Mp3Frames.Clean(bytes);
                if (ms == 0) throw new InvalidOperationException("Azure Speech trả về âm thanh rỗng.");

                var fileName = $"{SanitizeId(id)}-{Guid.NewGuid():N}.mp3";
                await File.WriteAllBytesAsync(Path.Combine(folder, fileName), frames, ct);
                var oldUrl = word.ExampleAudioUrl;
                word.ExampleVoice = voice;
                word.ExampleAudioUrl = $"{MediaOptions.UrlPrefix}/{Folder}/{fileName}";
                word.ExampleAudioText = text;
                await db.SaveChangesAsync(ct);
                DeleteAudio(oldUrl);
                job.Done++;
            }

            logger.LogInformation("Example audio: {Count} words", job.Done);
        }
        catch (Exception ex)
        {
            job.Error = ex is InvalidOperationException ? ex.Message : "Tạo giọng đọc câu ví dụ thất bại, xem log của API.";
            if (ex is not InvalidOperationException) logger.LogError(ex, "Example audio failed");
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

    private static string SanitizeId(string id) => string.Concat(id.Where(char.IsLetterOrDigit)).ToLowerInvariant();
}
