using FourUme.Application.About;
using FourUme.Application.Activity;
using FourUme.Application.Feedback;
using FourUme.Application.Invites;
using FourUme.Application.Premium;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Application.Pronunciation;

namespace FourUme.Application.Admin;

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminNotificationSettingsDto(NotificationConfig Value, NotificationConfig Defaults, DateTimeOffset? UpdatedAt);

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminListeningSettingsDto(ListeningConfig Value, ListeningConfig Defaults, DateTimeOffset? UpdatedAt);

/// <param name="UpdatedAt">null while the defaults are in use.</param>
/// <param name="Usage">Azure checks this calendar month (UTC).</param>
public record AdminPronunciationSettingsDto(
    PronunciationConfig Value,
    PronunciationConfig Defaults,
    DateTimeOffset? UpdatedAt,
    PronunciationUsageDto Usage,
    bool AzureConfigured,
    bool PaidConfigured = false);

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminReferralSettingsDto(ReferralConfig Value, ReferralConfig Defaults, DateTimeOffset? UpdatedAt);

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminStreakFreezeSettingsDto(StreakFreezeConfig Value, StreakFreezeConfig Defaults, DateTimeOffset? UpdatedAt);

public record AdminSettingsDto(
    AdminNotificationSettingsDto Notifications,
    AdminListeningSettingsDto Listening,
    AdminPronunciationSettingsDto Pronunciation,
    AdminReferralSettingsDto Referral,
    AdminStreakFreezeSettingsDto StreakFreeze);

public interface IAdminSettingsService
{
    Task<AdminSettingsDto> GetAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="NotificationConfigRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminSettingsDto> SaveNotificationsAsync(NotificationConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> ResetNotificationsAsync(CancellationToken ct = default);
    /// <summary>Applies a snapshot from the history (recorded as a restore).</summary>
    Task RestoreNotificationsAsync(NotificationConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> SaveListeningAsync(ListeningConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> ResetListeningAsync(CancellationToken ct = default);
    Task RestoreListeningAsync(ListeningConfig config, CancellationToken ct = default);
    /// <summary>Validates with <see cref="PronunciationRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminSettingsDto> SavePronunciationAsync(PronunciationConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> ResetPronunciationAsync(CancellationToken ct = default);
    Task RestorePronunciationAsync(PronunciationConfig config, CancellationToken ct = default);
    /// <summary>Validates with <see cref="ReferralRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminSettingsDto> SaveReferralAsync(ReferralConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> ResetReferralAsync(CancellationToken ct = default);
    Task RestoreReferralAsync(ReferralConfig config, CancellationToken ct = default);
    /// <summary>Validates with <see cref="StreakFreezeRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminSettingsDto> SaveStreakFreezeAsync(StreakFreezeConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> ResetStreakFreezeAsync(CancellationToken ct = default);
    Task RestoreStreakFreezeAsync(StreakFreezeConfig config, CancellationToken ct = default);
    Task<AdminAboutDto> GetAboutAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="AboutRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminAboutDto> SaveAboutAsync(AboutContent content, CancellationToken ct = default);
    Task<AdminAboutDto> ResetAboutAsync(CancellationToken ct = default);
    Task RestoreAboutAsync(AboutContent content, CancellationToken ct = default);
    Task<AdminPremiumPerksDto> GetPremiumPerksAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="PremiumPerkRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminPremiumPerksDto> SavePremiumPerksAsync(PremiumPerks perks, CancellationToken ct = default);
    Task<AdminPremiumPerksDto> ResetPremiumPerksAsync(CancellationToken ct = default);
    Task RestorePremiumPerksAsync(PremiumPerks perks, CancellationToken ct = default);

    Task<AdminFeedbackSettingsDto> GetFeedbackAsync(CancellationToken ct = default);
    Task<AdminFeedbackSettingsDto> SaveFeedbackAsync(FeedbackSettings settings, CancellationToken ct = default);
    Task<AdminFeedbackSettingsDto> ResetFeedbackAsync(CancellationToken ct = default);
    Task RestoreFeedbackAsync(FeedbackSettings settings, CancellationToken ct = default);

    Task<AdminNotificationTextsDto> GetNotificationTextsAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="NotificationTextRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminNotificationTextsDto> SaveNotificationTextsAsync(NotificationTexts texts, CancellationToken ct = default);
    Task<AdminNotificationTextsDto> ResetNotificationTextsAsync(CancellationToken ct = default);
    Task RestoreNotificationTextsAsync(NotificationTexts texts, CancellationToken ct = default);
}
