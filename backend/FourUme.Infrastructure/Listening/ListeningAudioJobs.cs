using System.Collections.Concurrent;
using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Listening;

public sealed record SpeechUsage(string Month, int Chars);

/// <summary>
/// Generates listening audio in the background (one at a time per piece). Progress and the last failure live in
/// memory only: after a restart a piece simply shows its stored audio state again.
/// </summary>
public sealed class ListeningAudioJobs(
    IServiceScopeFactory scopes,
    AzureSpeechClient speech,
    IOptions<MediaOptions> media,
    IHostApplicationLifetime lifetime,
    ILogger<ListeningAudioJobs> logger)
{
    public const string UsageKey = "speech-usage";
    public const string Folder = "listening";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public sealed class Job
    {
        public int Done { get; set; }
        public int Total { get; init; }
        public bool Running { get; set; } = true;
        public string? Error { get; set; }
    }

    private readonly ConcurrentDictionary<string, Job> _jobs = new();

    public Job? Get(string slug) => _jobs.TryGetValue(slug, out var job) ? job : null;

    public Job Start(ListeningLessonDocument doc)
    {
        var job = new Job { Total = doc.Lines.Count };
        if (_jobs.TryGetValue(doc.Slug, out var current) && current.Running)
            throw new InvalidOperationException("Bài này đang được tạo âm thanh.");
        _jobs[doc.Slug] = job;
        _ = Task.Run(() => RunAsync(doc, job, lifetime.ApplicationStopping));
        return job;
    }

    private async Task RunAsync(ListeningLessonDocument doc, Job job, CancellationToken ct)
    {
        var folder = Path.Combine(Path.GetFullPath(media.Value.Path), Folder);
        string? written = null;
        var billed = 0;
        try
        {
            var voices = doc.Speakers.ToDictionary(s => s.Key, s => s.Voice);
            var rate = ListeningRules.SpeakingRate(doc.Level);
            using var audio = new MemoryStream();
            var timings = new List<int[]>();
            var cursor = 0;

            foreach (var line in doc.Lines)
            {
                var bytes = await speech.SynthesizeAsync(voices[line.Speaker], line.En, rate, ct);
                billed += AzureSpeechClient.BilledChars(line.En);
                var (frames, ms) = Mp3Frames.Clean(bytes);
                if (ms == 0) throw new InvalidOperationException("Azure Speech trả về âm thanh rỗng.");
                audio.Write(frames);
                timings.Add([cursor, cursor + Math.Max(0, ms - AzureSpeechClient.PauseMs)]);
                cursor += ms;
                job.Done++;
            }

            Directory.CreateDirectory(folder);
            var fileName = $"{doc.Slug}-{Guid.NewGuid():N}.mp3";
            written = Path.Combine(folder, fileName);
            await File.WriteAllBytesAsync(written, audio.ToArray(), ct);

            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var lesson = await db.ListeningLessons.FirstOrDefaultAsync(l => l.Slug == doc.Slug, ct)
                ?? throw new InvalidOperationException("Bài đã bị xoá trong lúc tạo âm thanh.");
            var oldUrl = lesson.AudioUrl;
            lesson.AudioUrl = $"{MediaOptions.UrlPrefix}/{Folder}/{fileName}";
            lesson.AudioHash = ListeningRules.AudioHash(doc);
            lesson.DurationMs = cursor;
            lesson.TimingsJson = JsonSerializer.Serialize(timings);
            await db.SaveChangesAsync(ct);
            written = null;
            DeleteFile(folder, oldUrl);
            logger.LogInformation("Listening audio for {Slug}: {Lines} lines, {Seconds}s", doc.Slug, doc.Lines.Count, cursor / 1000);
        }
        catch (Exception ex)
        {
            job.Error = ex is InvalidOperationException ? ex.Message : "Tạo âm thanh thất bại, xem log của API.";
            if (ex is not InvalidOperationException) logger.LogError(ex, "Listening audio for {Slug} failed", doc.Slug);
            if (written is not null && File.Exists(written)) File.Delete(written);
        }
        finally
        {
            job.Running = false;
            if (billed > 0) await AddUsageAsync(billed);
        }
    }

    public async Task<SpeechUsage> GetUsageAsync(IAppDbContext db, CancellationToken ct)
    {
        var month = DateTimeOffset.UtcNow.ToString("yyyy-MM");
        var stored = await db.AppSettings.AsNoTracking().Where(s => s.Key == UsageKey).Select(s => s.Value).FirstOrDefaultAsync(ct);
        var usage = stored is null ? null : JsonSerializer.Deserialize<SpeechUsage>(stored, Json);
        return usage is not null && usage.Month == month ? usage : new SpeechUsage(month, 0);
    }

    public async Task AddUsageAsync(int chars)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var current = await GetUsageAsync(db, CancellationToken.None);
            var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == UsageKey);
            if (row is null)
            {
                row = new AppSetting { Key = UsageKey };
                db.AppSettings.Add(row);
            }
            row.Value = JsonSerializer.Serialize(current with { Chars = current.Chars + chars }, Json);
            row.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not record speech usage");
        }
    }

    public void DeleteAudio(string? url) => DeleteFile(Path.Combine(Path.GetFullPath(media.Value.Path), Folder), url);

    private static void DeleteFile(string folder, string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        var path = Path.Combine(folder, Path.GetFileName(url));
        if (File.Exists(path)) File.Delete(path);
    }
}
