using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Writing;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Ai;
using FourUme.Infrastructure.Invites;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Writing;

public sealed class WritingService(
    IAppDbContext db,
    IClientClock clock,
    IActivityService activity,
    AiClient ai,
    WritingGrader grader,
    ILogger<WritingService> logger) : IWritingService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<WritingConfig> LoadConfigAsync(IAppDbContext db, CancellationToken ct)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == WritingConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new WritingConfig() : JsonSerializer.Deserialize<WritingConfig>(stored, Json) ?? new WritingConfig();
    }

    /// <summary>Start of the UTC day, which the shared daily cap counts from (the AI quotas reset by UTC too).</summary>
    public static DateTimeOffset UtcDayStart() => new(DateTime.UtcNow.Date, TimeSpan.Zero);

    public static IReadOnlyList<string> ProvidersFor(WritingConfig config, bool premium) =>
        premium && config.PremiumProviders is { Count: > 0 } ? config.PremiumProviders : config.Providers;

    public async Task<WritingStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default) =>
        (await BuildStatusAsync(userId, await LoadConfigAsync(db, ct), ct)).Status;

    public async Task<IReadOnlyList<WritingPromptDto>> GetPromptsAsync(CancellationToken ct = default)
    {
        var rows = await db.WritingPrompts.AsNoTracking()
            .Where(p => p.Published)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt)
            .ToListAsync(ct);
        return rows.OrderBy(p => Array.IndexOf(WritingRules.Levels, p.Level)).Select(ToDto).ToList();
    }

    public async Task<WritingSubmitResponse> SubmitAsync(Guid userId, SubmitWritingRequest request, CancellationToken ct = default)
    {
        var text = WritingGrader.NormalizeText(request.Text);
        if (text.Length > WritingRules.MaxText)
            throw new WritingException(400, $"Bài dài quá {WritingRules.MaxText} ký tự (khoảng 250 từ), bạn rút gọn lại nhé.");
        var words = WritingRules.CountWords(text);
        if (words < WritingRules.MinWords) throw new WritingException(400, $"Bạn viết ít nhất {WritingRules.MinWords} từ để AI chấm được nhé.");

        var config = await LoadConfigAsync(db, ct);
        var (status, premium) = await BuildStatusAsync(userId, config, ct);
        if (!status.Enabled) throw new WritingException(503, "Luyện viết với AI đang tạm tắt.");
        if (!status.Available) throw new WritingException(503, "Luyện viết với AI chưa sẵn sàng, bạn quay lại sau nhé.");
        if (status.Remaining <= 0) throw new WritingException(429, "Bạn đã dùng hết lượt chấm bài hôm nay.", "limit");
        if (status.DayFull)
            throw new WritingException(429, "Hôm nay 4UME đã chấm hết số bài dành cho gói miễn phí, bạn quay lại vào ngày mai nhé.", "dayFull");

        WritingPrompt? prompt = null;
        if (request.PromptId is { } promptId)
        {
            prompt = await db.WritingPrompts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == promptId && p.Published, ct)
                     ?? throw new WritingException(404, "Không tìm thấy đề bài này.");
        }
        var level = prompt?.Level ?? NormalizeLevel(request.Level);
        var topic = prompt is null ? Clip((request.Topic ?? "").Trim(), WritingRules.MaxTopic) : null;
        if (request.ParentId is { } parentId && !await db.WritingSubmissions.AnyAsync(s => s.Id == parentId && s.UserId == userId, ct))
            throw new WritingException(404, "Không tìm thấy bài viết cũ.");

        var (min, max) = WordRange(prompt, level);
        WritingResultDto result;
        string model;
        try
        {
            (result, model) = await grader.GradeAsync(ProvidersFor(config, premium),
                new WritingTask(level, prompt?.PromptEn, string.IsNullOrEmpty(topic) ? null : topic, min, max), text, ct);
        }
        catch (InvalidOperationException ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Writing grading failed: {Message}", ex.Message);
            throw new WritingException(503, WritingGrader.BusyMessage, "busy");
        }

        var submission = new WritingSubmission
        {
            UserId = userId,
            PromptId = prompt?.Id,
            Topic = string.IsNullOrEmpty(topic) ? null : topic,
            Level = level,
            Text = text,
            WordCount = words,
            Score = result.Score,
            Result = JsonSerializer.Serialize(result, Json),
            Model = model,
            ParentId = request.ParentId,
            LocalDate = clock.Today,
        };
        db.WritingSubmissions.Add(submission);
        await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Studied, ct);

        var after = status with { UsedToday = status.UsedToday + 1, Remaining = Math.Max(0, status.Remaining - 1) };
        return new WritingSubmitResponse(ToDto(submission, prompt, result, Locked(config, premium)), after);
    }

    public async Task<WritingHistoryDto> GetHistoryAsync(Guid userId, CancellationToken ct = default)
    {
        var config = await LoadConfigAsync(db, ct);
        var premium = (await Entitlements.GetAsync(db, userId, ct)).Premium;
        var all = db.WritingSubmissions.AsNoTracking().Where(s => s.UserId == userId);
        var total = await all.CountAsync(ct);
        var shown = premium ? total : Math.Min(total, config.FreeHistoryCount);
        var rows = await all.OrderByDescending(s => s.CreatedAt)
            .Take(shown)
            .Select(s => new { s.Id, Title = s.Prompt != null ? s.Prompt.TitleVi : s.Topic, s.Level, s.Score, s.WordCount, s.CreatedAt, s.Text })
            .ToListAsync(ct);
        var items = rows.Select(r => new WritingHistoryItemDto(r.Id, string.IsNullOrWhiteSpace(r.Title) ? "Viết tự do" : r.Title, r.Level, r.Score,
            r.WordCount, r.CreatedAt, Excerpt(r.Text))).ToList();
        return new WritingHistoryDto(items, total, total - shown);
    }

    public async Task<WritingSubmissionDto> GetAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var s = await db.WritingSubmissions.AsNoTracking().Include(x => x.Prompt).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
                ?? throw new WritingException(404, "Không tìm thấy bài viết.");
        var config = await LoadConfigAsync(db, ct);
        var premium = (await Entitlements.GetAsync(db, userId, ct)).Premium;
        if (!premium)
        {
            var newer = await db.WritingSubmissions.CountAsync(x => x.UserId == userId && x.CreatedAt > s.CreatedAt, ct);
            if (newer >= config.FreeHistoryCount)
                throw new WritingException(403, $"Gói miễn phí xem lại được {config.FreeHistoryCount} bài gần nhất. Premium xem được tất cả bài đã viết.");
        }
        return ToDto(s, s.Prompt, Read(s.Result), Locked(config, premium));
    }

    public async Task DeleteAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var s = await db.WritingSubmissions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct)
                ?? throw new WritingException(404, "Không tìm thấy bài viết.");
        db.WritingSubmissions.Remove(s);
        await db.SaveChangesAsync(ct);
    }

    private async Task<(WritingStatusDto Status, bool Premium)> BuildStatusAsync(Guid userId, WritingConfig config, CancellationToken ct)
    {
        var premium = (await Entitlements.GetAsync(db, userId, ct)).Premium;
        var today = clock.Today;
        var used = await db.WritingSubmissions.CountAsync(s => s.UserId == userId && s.LocalDate == today, ct);
        var limit = premium ? config.PremiumDailyChecks : config.FreeDailyChecks;
        var available = ProvidersFor(config, premium).Any(ai.IsConfigured);
        var on = config.Enabled && available;
        var dayFull = false;
        if (on && config.DailyTotalCap > 0)
        {
            var since = UtcDayStart();
            var everyone = await db.WritingSubmissions.CountAsync(s => s.CreatedAt >= since, ct);
            var open = premium ? config.DailyTotalCap : config.DailyTotalCap * (100 - config.PremiumReservePercent) / 100;
            dayFull = everyone >= open;
        }
        return (new WritingStatusDto(config.Enabled, available, premium, limit, used, on ? Math.Max(0, limit - used) : 0,
            config.FreeDailyChecks, config.PremiumDailyChecks, config.RewritePremiumOnly, config.FreeHistoryCount, dayFull), premium);
    }

    private static bool Locked(WritingConfig config, bool premium) => config.RewritePremiumOnly && !premium;

    internal static (int Min, int Max) WordRange(WritingPrompt? prompt, string level)
    {
        var (min, max) = WritingRules.WordRange(level);
        return (prompt?.MinWords > 0 ? prompt.MinWords : min, prompt?.MaxWords > 0 ? prompt.MaxWords : max);
    }

    private static string NormalizeLevel(string? level)
    {
        var l = (level ?? "").Trim().ToUpperInvariant();
        return WritingRules.Levels.Contains(l) ? l : "A1";
    }

    private static WritingResultDto Read(string json) =>
        JsonSerializer.Deserialize<WritingResultDto>(json, Json) ?? throw new WritingException(500, "Kết quả chấm bị hỏng.");

    private static string Excerpt(string text)
    {
        var flat = text.Replace('\n', ' ');
        return flat.Length <= 120 ? flat : flat[..120].TrimEnd() + "…";
    }

    private static string Clip(string s, int max) => s.Length <= max ? s : s[..max].TrimEnd();

    internal static WritingPromptDto ToDto(WritingPrompt p)
    {
        var (min, max) = WordRange(p, p.Level);
        return new WritingPromptDto(p.Id, p.Level, p.TitleVi, p.Icon, p.PromptEn, p.GuideVi, min, max, p.KeyPhrases);
    }

    private static WritingSubmissionDto ToDto(WritingSubmission s, WritingPrompt? prompt, WritingResultDto result, bool locked) => new(
        s.Id, s.PromptId, prompt?.TitleVi, prompt?.PromptEn, s.Level, s.Topic, s.Text, s.WordCount, s.CreatedAt,
        WritingGrader.ForLearner(result, locked));
}
