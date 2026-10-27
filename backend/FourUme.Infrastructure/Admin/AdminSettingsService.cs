using System.Text.Json;
using FourUme.Application.About;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Admin;
using FourUme.Application.Feedback;
using FourUme.Application.Invites;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Application.Premium;
using FourUme.Application.Pronunciation;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Pronunciation;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminSettingsService(
    IAppDbContext db,
    INotificationService notifications,
    IListeningService listening,
    IPronunciationService pronunciation,
    AzurePronunciationClient azure,
    IAboutService about,
    IPremiumPerksService premiumPerks,
    IFeedbackSettingsService feedback,
    IReferralService referral,
    IStreakFreezeSettings streakFreeze,
    Auditor auditor) : IAdminSettingsService
{
    private const string ReferralSummary = "Thông số mời bạn bè";
    private const string PremiumSummary = "Quyền lợi Premium";
    private const string FeedbackSummary = "Cài đặt góp ý";
    private const string NotificationTextsSummary = "Nội dung thông báo";
    private const string NotificationsSummary = "Thông số thông báo";
    private const string ListeningSummary = "Thông số góc nghe";
    private const string PronunciationSummary = "Thông số kiểm tra giọng đọc";
    private const string StreakFreezeSummary = "Thông số đóng băng chuỗi";
    private const string AboutSummary = "Nội dung Giới thiệu & bản quyền";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AdminSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == NotificationConfig.SettingKey || s.Key == ListeningConfig.SettingKey || s.Key == PronunciationConfig.SettingKey
                || s.Key == ReferralConfig.SettingKey || s.Key == StreakFreezeConfig.SettingKey)
            .ToDictionaryAsync(s => s.Key, s => s.UpdatedAt, ct);
        return new AdminSettingsDto(
            new AdminNotificationSettingsDto(await notifications.GetConfigAsync(ct), new NotificationConfig(),
                updated.TryGetValue(NotificationConfig.SettingKey, out var n) ? n : null),
            new AdminListeningSettingsDto(await listening.GetConfigAsync(ct), new ListeningConfig(),
                updated.TryGetValue(ListeningConfig.SettingKey, out var l) ? l : null),
            new AdminPronunciationSettingsDto(await pronunciation.GetConfigAsync(ct), new PronunciationConfig(),
                updated.TryGetValue(PronunciationConfig.SettingKey, out var p) ? p : null,
                await pronunciation.GetMonthUsageAsync(ct), azure.Configured, azure.PaidConfigured),
            new AdminReferralSettingsDto(await referral.GetConfigAsync(ct), new ReferralConfig(),
                updated.TryGetValue(ReferralConfig.SettingKey, out var r) ? r : null),
            new AdminStreakFreezeSettingsDto(await streakFreeze.GetAsync(ct), new StreakFreezeConfig(),
                updated.TryGetValue(StreakFreezeConfig.SettingKey, out var sf) ? sf : null));
    }

    public async Task<AdminSettingsDto> SaveStreakFreezeAsync(StreakFreezeConfig config, CancellationToken ct = default)
    {
        await ApplyStreakFreezeAsync(config, AuditActions.Update, ct);
        return await GetAsync(ct);
    }

    public async Task<AdminSettingsDto> ResetStreakFreezeAsync(CancellationToken ct = default)
    {
        await ResetAsync(StreakFreezeConfig.SettingKey, StreakFreezeSummary, await streakFreeze.GetAsync(ct), new StreakFreezeConfig(), ct);
        return await GetAsync(ct);
    }

    public Task RestoreStreakFreezeAsync(StreakFreezeConfig config, CancellationToken ct = default) =>
        ApplyStreakFreezeAsync(config, AuditActions.Restore, ct);

    private async Task ApplyStreakFreezeAsync(StreakFreezeConfig config, string action, CancellationToken ct)
    {
        var problems = StreakFreezeRules.Validate(config);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(StreakFreezeConfig.SettingKey, StreakFreezeSummary, action, await streakFreeze.GetAsync(ct), config, ct);
    }

    public async Task<AdminSettingsDto> SaveReferralAsync(ReferralConfig config, CancellationToken ct = default)
    {
        await ApplyReferralAsync(config, AuditActions.Update, ct);
        return await GetAsync(ct);
    }

    public async Task<AdminSettingsDto> ResetReferralAsync(CancellationToken ct = default)
    {
        await ResetAsync(ReferralConfig.SettingKey, ReferralSummary, await referral.GetConfigAsync(ct), new ReferralConfig(), ct);
        return await GetAsync(ct);
    }

    public Task RestoreReferralAsync(ReferralConfig config, CancellationToken ct = default) =>
        ApplyReferralAsync(config, AuditActions.Restore, ct);

    private async Task ApplyReferralAsync(ReferralConfig config, string action, CancellationToken ct)
    {
        var problems = ReferralRules.Validate(config);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        config = config with { CodePrefix = ReferralRules.NormalizePrefix(config.CodePrefix)! };
        if (await db.Partners.AnyAsync(p => p.Prefix == config.CodePrefix, ct))
            throw new InvalidOperationException($"Tiền tố {config.CodePrefix} đang thuộc một đối tác, bạn chọn tiền tố khác cho mã mời nhé.");
        await WriteAsync(ReferralConfig.SettingKey, ReferralSummary, action, await referral.GetConfigAsync(ct), config, ct);
    }

    public async Task<AdminSettingsDto> SaveNotificationsAsync(NotificationConfig config, CancellationToken ct = default)
    {
        await ApplyNotificationsAsync(config, AuditActions.Update, ct);
        return await GetAsync(ct);
    }

    public async Task<AdminSettingsDto> ResetNotificationsAsync(CancellationToken ct = default)
    {
        await ResetAsync(NotificationConfig.SettingKey, NotificationsSummary, await notifications.GetConfigAsync(ct), new NotificationConfig(), ct);
        return await GetAsync(ct);
    }

    public Task RestoreNotificationsAsync(NotificationConfig config, CancellationToken ct = default) =>
        ApplyNotificationsAsync(config, AuditActions.Restore, ct);

    public async Task<AdminSettingsDto> SaveListeningAsync(ListeningConfig config, CancellationToken ct = default)
    {
        await WriteAsync(ListeningConfig.SettingKey, ListeningSummary, AuditActions.Update, await listening.GetConfigAsync(ct), config, ct);
        return await GetAsync(ct);
    }

    public async Task<AdminSettingsDto> ResetListeningAsync(CancellationToken ct = default)
    {
        await ResetAsync(ListeningConfig.SettingKey, ListeningSummary, await listening.GetConfigAsync(ct), new ListeningConfig(), ct);
        return await GetAsync(ct);
    }

    public async Task RestoreListeningAsync(ListeningConfig config, CancellationToken ct = default) =>
        await WriteAsync(ListeningConfig.SettingKey, ListeningSummary, AuditActions.Restore, await listening.GetConfigAsync(ct), config, ct);

    public async Task<AdminSettingsDto> SavePronunciationAsync(PronunciationConfig config, CancellationToken ct = default)
    {
        await ApplyPronunciationAsync(config, AuditActions.Update, ct);
        return await GetAsync(ct);
    }

    public async Task<AdminSettingsDto> ResetPronunciationAsync(CancellationToken ct = default)
    {
        await ResetAsync(PronunciationConfig.SettingKey, PronunciationSummary, await pronunciation.GetConfigAsync(ct), new PronunciationConfig(), ct);
        return await GetAsync(ct);
    }

    public Task RestorePronunciationAsync(PronunciationConfig config, CancellationToken ct = default) =>
        ApplyPronunciationAsync(config, AuditActions.Restore, ct);

    public async Task<AdminAboutDto> GetAboutAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == AboutContent.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminAboutDto(await about.GetAsync(ct), AboutContent.Default(), updated);
    }

    public async Task<AdminAboutDto> SaveAboutAsync(AboutContent content, CancellationToken ct = default)
    {
        await ApplyAboutAsync(content, AuditActions.Update, ct);
        return await GetAboutAsync(ct);
    }

    public async Task<AdminAboutDto> ResetAboutAsync(CancellationToken ct = default)
    {
        await ResetAsync(AboutContent.SettingKey, AboutSummary, await about.GetAsync(ct), AboutContent.Default(), ct);
        return await GetAboutAsync(ct);
    }

    public Task RestoreAboutAsync(AboutContent content, CancellationToken ct = default) =>
        ApplyAboutAsync(content, AuditActions.Restore, ct);

    private async Task ApplyAboutAsync(AboutContent content, string action, CancellationToken ct)
    {
        var next = AboutRules.Normalize(content);
        var problems = AboutRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(AboutContent.SettingKey, AboutSummary, action, await about.GetAsync(ct), next, ct);
    }

    public async Task<AdminPremiumPerksDto> GetPremiumPerksAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == PremiumPerks.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminPremiumPerksDto(await premiumPerks.GetAsync(ct), PremiumPerks.Default(), updated);
    }

    public async Task<AdminPremiumPerksDto> SavePremiumPerksAsync(PremiumPerks perks, CancellationToken ct = default)
    {
        await ApplyPremiumPerksAsync(perks, AuditActions.Update, ct);
        return await GetPremiumPerksAsync(ct);
    }

    public async Task<AdminPremiumPerksDto> ResetPremiumPerksAsync(CancellationToken ct = default)
    {
        await ResetAsync(PremiumPerks.SettingKey, PremiumSummary, await premiumPerks.GetAsync(ct), PremiumPerks.Default(), ct);
        return await GetPremiumPerksAsync(ct);
    }

    public Task RestorePremiumPerksAsync(PremiumPerks perks, CancellationToken ct = default) =>
        ApplyPremiumPerksAsync(perks, AuditActions.Restore, ct);

    private async Task ApplyPremiumPerksAsync(PremiumPerks perks, string action, CancellationToken ct)
    {
        var next = PremiumPerkRules.Normalize(perks);
        var problems = PremiumPerkRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(PremiumPerks.SettingKey, PremiumSummary, action, await premiumPerks.GetAsync(ct), next, ct);
    }

    public async Task<AdminFeedbackSettingsDto> GetFeedbackAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == FeedbackSettings.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminFeedbackSettingsDto(await feedback.GetAsync(ct), FeedbackSettings.Default(), updated);
    }

    public async Task<AdminFeedbackSettingsDto> SaveFeedbackAsync(FeedbackSettings settings, CancellationToken ct = default)
    {
        await ApplyFeedbackAsync(settings, AuditActions.Update, ct);
        return await GetFeedbackAsync(ct);
    }

    public async Task<AdminFeedbackSettingsDto> ResetFeedbackAsync(CancellationToken ct = default)
    {
        await ResetAsync(FeedbackSettings.SettingKey, FeedbackSummary, await feedback.GetAsync(ct), FeedbackSettings.Default(), ct);
        return await GetFeedbackAsync(ct);
    }

    public Task RestoreFeedbackAsync(FeedbackSettings settings, CancellationToken ct = default) =>
        ApplyFeedbackAsync(settings, AuditActions.Restore, ct);

    private async Task ApplyFeedbackAsync(FeedbackSettings settings, string action, CancellationToken ct)
    {
        var next = FeedbackRules.Normalize(settings);
        var problems = FeedbackRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(FeedbackSettings.SettingKey, FeedbackSummary, action, await feedback.GetAsync(ct), next, ct);
    }

    public async Task<AdminNotificationTextsDto> GetNotificationTextsAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == NotificationTexts.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminNotificationTextsDto(await notifications.GetTextsAsync(ct), new NotificationTexts(), updated);
    }

    public async Task<AdminNotificationTextsDto> SaveNotificationTextsAsync(NotificationTexts texts, CancellationToken ct = default)
    {
        await ApplyNotificationTextsAsync(texts, AuditActions.Update, ct);
        return await GetNotificationTextsAsync(ct);
    }

    public async Task<AdminNotificationTextsDto> ResetNotificationTextsAsync(CancellationToken ct = default)
    {
        await ResetAsync(NotificationTexts.SettingKey, NotificationTextsSummary, await notifications.GetTextsAsync(ct), new NotificationTexts(), ct);
        return await GetNotificationTextsAsync(ct);
    }

    public Task RestoreNotificationTextsAsync(NotificationTexts texts, CancellationToken ct = default) =>
        ApplyNotificationTextsAsync(texts, AuditActions.Restore, ct);

    private async Task ApplyNotificationTextsAsync(NotificationTexts texts, string action, CancellationToken ct)
    {
        var next = NotificationTextRules.Normalize(texts);
        var problems = NotificationTextRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(NotificationTexts.SettingKey, NotificationTextsSummary, action, await notifications.GetTextsAsync(ct), next, ct);
    }

    private async Task ApplyNotificationsAsync(NotificationConfig config, string action, CancellationToken ct)
    {
        var next = NotificationConfigRules.Normalize(config);
        var problems = NotificationConfigRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(NotificationConfig.SettingKey, NotificationsSummary, action, await notifications.GetConfigAsync(ct), next, ct);
    }

    private async Task ApplyPronunciationAsync(PronunciationConfig config, string action, CancellationToken ct)
    {
        var problems = PronunciationRules.Validate(config);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(PronunciationConfig.SettingKey, PronunciationSummary, action, await pronunciation.GetConfigAsync(ct), config, ct);
    }

    private async Task WriteAsync<T>(string key, string summary, string action, T before, T next, CancellationToken ct)
    {
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is null)
        {
            row = new AppSetting { Key = key };
            db.AppSettings.Add(row);
        }
        row.Value = JsonSerializer.Serialize(next, Json);
        row.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Settings, key, action, summary, before, next);
        await db.SaveChangesAsync(ct);
    }

    private async Task ResetAsync<T>(string key, string summary, T before, T defaults, CancellationToken ct)
    {
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is not null) db.AppSettings.Remove(row);
        auditor.Record(AuditEntities.Settings, key, AuditActions.Update, summary, before, defaults);
        await db.SaveChangesAsync(ct);
    }
}
