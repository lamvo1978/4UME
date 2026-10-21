using FourUme.Application.Abstractions;
using FourUme.Application.Conversations;
using FourUme.Application.Listening;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Conversations;

/// <param name="Url">Null when the phone's voice should read the reply.</param>
public sealed record SpokenReply(string? Url, int Chars, bool Paid)
{
    public static readonly SpokenReply Device = new(null, 0, false);
}

/// <summary>
/// Reads AI replies with an Azure voice for Premium learners while the admin allows it: the free resource up to its
/// share, then the paid one up to its cap. Any failure leaves the reply to the phone's voice, so a talk never stalls.
/// </summary>
public sealed class ConversationVoice(
    IAppDbContext db,
    AzureSpeechClient speech,
    ListeningAudioJobs usage,
    IOptions<MediaOptions> media,
    ILogger<ConversationVoice> logger)
{
    public const string Folder = "conversation";
    /// <summary>Replies are only replayed during the talk.</summary>
    private static readonly TimeSpan KeepFor = TimeSpan.FromDays(2);
    /// <summary>The learner is waiting for the reply; past this the phone reads it.</summary>
    private static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(8);
    private static DateTimeOffset _lastSweep = DateTimeOffset.MinValue;

    public sealed record MonthUsage(int FreeChars, int PaidChars);

    public static DateTimeOffset MonthStart()
    {
        var now = DateTimeOffset.UtcNow;
        return new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }

    public async Task<MonthUsage> GetMonthUsageAsync(CancellationToken ct)
    {
        var month = MonthStart();
        var rows = await db.ConversationTurns.AsNoTracking()
            .Where(t => t.CreatedAt >= month && t.TtsChars > 0)
            .GroupBy(t => t.TtsPaid)
            .Select(g => new { Paid = g.Key, Chars = g.Sum(t => t.TtsChars) })
            .ToListAsync(ct);
        return new MonthUsage(rows.FirstOrDefault(r => !r.Paid)?.Chars ?? 0, rows.FirstOrDefault(r => r.Paid)?.Chars ?? 0);
    }

    /// <summary>Whether Premium replies would get an Azure voice now (budget left on either resource).</summary>
    public async Task<bool> AvailableAsync(ConversationConfig config, CancellationToken ct)
    {
        if (!config.PremiumAzureVoice || (!speech.Options.Configured && !speech.Options.PaidConfigured)) return false;
        var (useFree, usePaid) = await BudgetAsync(config, AzureSpeechClient.BilledChars("Hello there"), ct);
        return useFree || usePaid;
    }

    public async Task<SpokenReply> ReadAsync(string text, string level, ConversationConfig config, CancellationToken ct)
    {
        if (!config.PremiumAzureVoice || string.IsNullOrWhiteSpace(text)) return SpokenReply.Device;
        var billed = AzureSpeechClient.BilledChars(text);
        var (useFree, usePaid) = await BudgetAsync(config, billed, ct);
        var rate = ListeningRules.SpeakingRate(level);

        if (useFree)
        {
            var bytes = await TryAsync(config.AzureVoice, text, rate, false, ct);
            if (bytes is not null)
            {
                await usage.AddUsageAsync(billed);
                return await SaveAsync(bytes, billed, false);
            }
        }
        if (usePaid)
        {
            var bytes = await TryAsync(config.AzureVoice, text, rate, true, ct);
            if (bytes is not null) return await SaveAsync(bytes, billed, true);
        }
        return SpokenReply.Device;
    }

    private async Task<(bool UseFree, bool UsePaid)> BudgetAsync(ConversationConfig config, int billed, CancellationToken ct)
    {
        var month = await GetMonthUsageAsync(ct);
        var speechMonth = await usage.GetUsageAsync(db, ct);
        var useFree = speech.Options.Configured
                      && month.FreeChars + billed <= config.FreeMonthlyChars
                      && speechMonth.Chars + billed <= speech.Options.MonthlyCharLimit;
        var usePaid = speech.Options.PaidConfigured && month.PaidChars + billed <= config.PaidMonthlyChars;
        return (useFree, usePaid);
    }

    private async Task<byte[]?> TryAsync(string voice, string text, string rate, bool paid, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(MaxWait);
        try
        {
            var bytes = await speech.SynthesizeAsync(voice, text, rate, timeout.Token, paid, maxAttempts: 1);
            var (frames, ms) = Mp3Frames.Clean(bytes);
            return ms == 0 ? null : frames;
        }
        catch (Exception ex) when (ex is OperationCanceledException or InvalidOperationException or HttpRequestException)
        {
            if (ct.IsCancellationRequested) throw;
            logger.LogWarning("Conversation voice ({Tier}) failed: {Message}", paid ? "paid" : "free", ex.Message);
            return null;
        }
    }

    private async Task<SpokenReply> SaveAsync(byte[] audio, int billed, bool paid)
    {
        var folder = Path.Combine(Path.GetFullPath(media.Value.Path), Folder);
        Directory.CreateDirectory(folder);
        Sweep(folder);
        var fileName = $"{Guid.NewGuid():N}.mp3";
        await File.WriteAllBytesAsync(Path.Combine(folder, fileName), audio, CancellationToken.None);
        return new SpokenReply($"{MediaOptions.UrlPrefix}/{Folder}/{fileName}", billed, paid);
    }

    /// <summary>Deletes old replies, at most once an hour.</summary>
    private void Sweep(string folder)
    {
        var now = DateTimeOffset.UtcNow;
        if (now - _lastSweep < TimeSpan.FromHours(1)) return;
        _lastSweep = now;
        try
        {
            foreach (var file in Directory.EnumerateFiles(folder, "*.mp3"))
                if (now - File.GetLastWriteTimeUtc(file) > KeepFor) File.Delete(file);
        }
        catch (IOException ex)
        {
            logger.LogWarning(ex, "Could not clean old conversation audio");
        }
    }
}
