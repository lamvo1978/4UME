using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Pronunciation;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Invites;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Pronunciation;

public class PronunciationService(IAppDbContext db, IClientClock clock, AzurePronunciationClient azure) : IPronunciationService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<PronunciationConfig> GetConfigAsync(CancellationToken ct = default)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == PronunciationConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new PronunciationConfig() : JsonSerializer.Deserialize<PronunciationConfig>(stored, Json) ?? new PronunciationConfig();
    }

    public async Task<PronunciationStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default) =>
        (await BuildStatusAsync(userId, await GetConfigAsync(ct), ct)).Status;

    public async Task<PronunciationResultDto> AssessAsync(Guid userId, string wordId, Stream audio, CancellationToken ct = default)
    {
        var config = await GetConfigAsync(ct);
        var (status, useFree, usePaid) = await BuildStatusAsync(userId, config, ct);
        if (!status.Enabled) throw new PronunciationException(503, "Tính năng chấm phát âm đang tạm tắt.");
        if (!status.ServiceAvailable) throw new PronunciationException(503, "Chấm phát âm chi tiết đang tạm dừng, bạn quay lại sau nhé.");

        if (status.Remaining <= 0) throw new PronunciationException(429, "Bạn đã dùng hết lượt chấm chi tiết hôm nay.");

        var word = await db.Words.AsNoTracking()
            .Where(w => w.Id == wordId && w.Published)
            .Select(w => w.Text)
            .FirstOrDefaultAsync(ct) ?? throw new PronunciationException(400, "Không tìm thấy từ.");

        var bytes = await ReadLimitedAsync(audio, ct);
        var (wav, durationMs) = await AudioConverter.ToWav16kAsync(bytes, ct);
        if (durationMs < 300) throw new PronunciationException(400, "Bản ghi quá ngắn, hãy giữ nút lâu hơn một chút.");

        var paid = !useFree;
        AzureAssessment? result;
        try
        {
            result = await azure.AssessAsync(wav, word, paid, MonthStart(), ct);
        }
        catch (AzureFreeTierRefusedException) when (usePaid)
        {
            paid = true;
            result = await azure.AssessAsync(wav, word, paid, MonthStart(), ct);
        }
        if (result is null) throw new PronunciationException(400, "Mình chưa nghe rõ, bạn đọc to và gần micro hơn nhé.");

        db.PronunciationAttempts.Add(new PronunciationAttempt
        {
            UserId = userId,
            WordId = wordId,
            LocalDate = clock.Today,
            AudioMs = durationMs,
            Paid = paid,
            Score = result.Accuracy,
            Phonemes = JsonSerializer.Serialize(result.Words.SelectMany(w => w.Phonemes), Json),
        });
        await db.SaveChangesAsync(ct);

        var after = status with { UsedToday = status.UsedToday + 1, Remaining = status.Remaining - 1 };
        // For a single word fluency is always ~100 and would inflate the overall score, so accuracy is the headline.
        return new PronunciationResultDto(result.Accuracy, result.Accuracy, result.Fluency, result.Completeness, result.Heard, result.Words, after);
    }

    public async Task<AdRewardOutcome> GrantAdRewardAsync(Guid userId, DateOnly localDate, string transactionId, string source, CancellationToken ct = default)
    {
        if (await db.AdRewards.AnyAsync(r => r.TransactionId == transactionId, ct)) return AdRewardOutcome.Duplicate;

        var config = await GetConfigAsync(ct);
        if (!await db.Users.AnyAsync(u => u.Id == userId, ct) || !config.Enabled || !config.AdRewardsEnabled
            || (await Entitlements.GetAsync(db, userId, ct)).Premium)
            return AdRewardOutcome.NotCounted;

        var watched = await db.AdRewards.CountAsync(r => r.UserId == userId && r.LocalDate == localDate, ct);
        if (watched >= config.AdRewardsPerDay) return AdRewardOutcome.NotCounted;

        db.AdRewards.Add(new AdReward { UserId = userId, LocalDate = localDate, TransactionId = transactionId, Source = source });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // TransactionId is the only unique column: AdMob retried while the first callback was being saved.
            return AdRewardOutcome.Duplicate;
        }
        return AdRewardOutcome.Granted;
    }

    public async Task<PronunciationUsageDto> GetMonthUsageAsync(CancellationToken ct = default)
    {
        var month = MonthStart();
        var attempts = db.PronunciationAttempts.AsNoTracking().Where(a => a.CreatedAt >= month);
        var count = await attempts.CountAsync(ct);
        var users = await attempts.Select(a => a.UserId).Distinct().CountAsync(ct);
        var freeMs = await attempts.Where(a => !a.Paid).SumAsync(a => (long)a.AudioMs, ct);
        var paidMs = await attempts.Where(a => a.Paid).SumAsync(a => (long)a.AudioMs, ct);
        var ads = await db.AdRewards.AsNoTracking().CountAsync(r => r.CreatedAt >= month, ct);
        return new PronunciationUsageDto(count, users, Math.Round(freeMs / 60000.0, 1), ads, Math.Round(paidMs / 60000.0, 1),
            azure.FreeSpent(month));
    }

    /// <param name="UseFree">The next check goes to the free resource first.</param>
    /// <param name="UsePaid">The paid resource may take the next check (directly, or when the free one refuses).</param>
    private record Budget(PronunciationStatusDto Status, bool UseFree, bool UsePaid);

    private async Task<Budget> BuildStatusAsync(Guid userId, PronunciationConfig config, CancellationToken ct)
    {
        var access = await Entitlements.GetAsync(db, userId, ct);
        var premium = access.Premium;
        var today = clock.Today;
        var used = await db.PronunciationAttempts.CountAsync(a => a.UserId == userId && a.LocalDate == today, ct);
        // Checks earned before going Premium stay valid for the rest of that day.
        var ads = await db.AdRewards.CountAsync(r => r.UserId == userId && r.LocalDate == today, ct);
        var limit = (premium ? config.PremiumDailyLimit : config.FreeDailyLimit) + ads;

        var month = MonthStart();
        var thisMonth = db.PronunciationAttempts.Where(a => a.CreatedAt >= month);
        var freeMs = await thisMonth.Where(a => !a.Paid).SumAsync(a => (long)a.AudioMs, ct);
        var paidMs = await thisMonth.Where(a => a.Paid).SumAsync(a => (long)a.AudioMs, ct);
        var useFree = azure.Configured && !azure.FreeSpent(month) && freeMs < config.MonthlyMinutesCap * 60_000L;
        // Premium checks and checks bought with an ad are promised, so the plain free allowance gives way first.
        var promised = premium || used >= config.FreeDailyLimit;
        var paidCapMs = config.PaidMonthlyMinutesCap * 60_000L * (promised ? 1 : PronunciationRules.FreePlanPaidShare);
        var usePaid = azure.PaidConfigured && paidMs < paidCapMs;
        var available = useFree || usePaid;

        var on = config.Enabled && available;
        var remaining = on ? Math.Max(0, limit - used) : 0;
        var adsLimit = on && config.AdRewardsEnabled && !premium ? config.AdRewardsPerDay : 0;
        var status = new PronunciationStatusDto(config.Enabled, premium, access.PremiumUntil, limit, used, remaining, available,
            config.PremiumDailyLimit, config.FreeDailyLimit, ads, adsLimit, Math.Max(0, adsLimit - ads), access.PartnerName,
            access.PartnerUntil, access.PausedPremiumDays, config.DeviceCheckWhenOut && remaining == 0);
        return new Budget(status, useFree, usePaid);
    }

    private static DateTimeOffset MonthStart()
    {
        var now = DateTimeOffset.UtcNow;
        return new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }

    private static async Task<byte[]> ReadLimitedAsync(Stream audio, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await audio.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > PronunciationRules.MaxAudioBytes)
                throw new PronunciationException(400, "Bản ghi quá dài.");
            buffer.Write(chunk, 0, read);
        }
        if (buffer.Length == 0) throw new PronunciationException(400, "Không nhận được bản ghi âm.");
        return buffer.ToArray();
    }
}
