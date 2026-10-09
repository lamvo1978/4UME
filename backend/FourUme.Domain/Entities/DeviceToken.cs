namespace FourUme.Domain.Entities;

/// <summary>An Expo push token of one of the user's devices.</summary>
public class DeviceToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    /// <summary>"ios" or "android".</summary>
    public string Platform { get; set; } = string.Empty;
    public string? AppVersion { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;
}
