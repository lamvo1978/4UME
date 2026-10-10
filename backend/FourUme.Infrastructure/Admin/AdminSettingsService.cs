using System.Text.Json;
using FourUme.Application.About;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Feedback;
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
    Auditor auditor) : IAdminSettingsService
{
    private const string PremiumSummary = "Quyền lợi Premium";
    private const string FeedbackSummary = "Cài đặt góp ý";
    private const string NotificationsSummary = "Thông số thông báo";
    private const string ListeningSummary = "Thông số góc nghe";
    private const string PronunciationSummary = "Thông số kiểm tra giọng đọc";
    private const string AboutSummary = "Nội dung Giới thiệu & bản quyền";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AdminSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == NotificationConfig.SettingKey || s.Key == ListeningConfig.SettingKey || s.Key == PronunciationConfig.SettingKey)
            .ToDictionaryAsync(s => s.Key, s => s.UpdatedAt, ct);
        return new AdminSettingsDto(
            new AdminNotificationSettingsDto(await notifications.GetConfigAsync(ct), new NotificationConfig(),
                updated.TryGetValue(NotificationConfig.SettingKey, out var n) ? n : null),
            new AdminListeningSettingsDto(await listening.GetConfigAsync(ct), new ListeningConfig(),
                updated.TryGetValue(ListeningConfig.SettingKey, out var l) ? l : null),
            new AdminPronunciationSettingsDto(await pronunciation.GetConfigAsync(ct), new PronunciationConfig(),
                updated.TryGetValue(PronunciationConfig.SettingKey, out var p) ? p : null,
                await pronunciation.GetMonthUsageAsync(ct), azure.Configured));
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
