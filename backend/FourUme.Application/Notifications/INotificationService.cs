namespace FourUme.Application.Notifications;

public interface INotificationService
{
    /// <summary>Stored parameters merged over the defaults.</summary>
    Task<NotificationConfig> GetConfigAsync(CancellationToken ct = default);

    /// <summary>Adds or refreshes a push token; a token seen under another account moves to this user.</summary>
    Task RegisterDeviceAsync(Guid userId, RegisterDeviceRequest request, CancellationToken ct = default);

    Task RemoveDeviceAsync(Guid userId, string token, CancellationToken ct = default);
}
