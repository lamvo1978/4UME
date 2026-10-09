using FourUme.Application.Notifications;

namespace FourUme.Application.Admin;

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminNotificationSettingsDto(NotificationConfig Value, NotificationConfig Defaults, DateTimeOffset? UpdatedAt);

public record AdminSettingsDto(AdminNotificationSettingsDto Notifications);

public interface IAdminSettingsService
{
    Task<AdminSettingsDto> GetAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="NotificationConfigRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminSettingsDto> SaveNotificationsAsync(NotificationConfig config, CancellationToken ct = default);
    Task<AdminSettingsDto> ResetNotificationsAsync(CancellationToken ct = default);
    /// <summary>Applies a snapshot from the history (recorded as a restore).</summary>
    Task RestoreNotificationsAsync(NotificationConfig config, CancellationToken ct = default);
}
