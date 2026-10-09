using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Notifications;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Notifications;

public class NotificationService(IAppDbContext db) : INotificationService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string[] Platforms = ["ios", "android"];

    public async Task<NotificationConfig> GetConfigAsync(CancellationToken ct = default)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == NotificationConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);

        // Missing properties keep their record defaults, so new parameters need no data migration.
        return stored is null ? new NotificationConfig() : JsonSerializer.Deserialize<NotificationConfig>(stored, Json) ?? new NotificationConfig();
    }

    public async Task RegisterDeviceAsync(Guid userId, RegisterDeviceRequest request, CancellationToken ct = default)
    {
        var token = request.Token?.Trim() ?? "";
        if (token.Length is < 10 or > 200) throw new InvalidOperationException("Mã thiết bị không hợp lệ.");
        var platform = request.Platform?.Trim().ToLowerInvariant() ?? "";
        if (!Platforms.Contains(platform)) throw new InvalidOperationException("Nền tảng không hợp lệ.");

        var now = DateTimeOffset.UtcNow;
        var device = await db.DeviceTokens.FirstOrDefaultAsync(d => d.Token == token, ct);
        if (device is null)
        {
            db.DeviceTokens.Add(new DeviceToken { UserId = userId, Token = token, Platform = platform, AppVersion = request.AppVersion });
        }
        else
        {
            device.UserId = userId;
            device.Platform = platform;
            device.AppVersion = request.AppVersion;
            device.LastSeenAt = now;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveDeviceAsync(Guid userId, string token, CancellationToken ct = default)
    {
        var device = await db.DeviceTokens.FirstOrDefaultAsync(d => d.UserId == userId && d.Token == token, ct);
        if (device is null) return;
        db.DeviceTokens.Remove(device);
        await db.SaveChangesAsync(ct);
    }
}
