using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminSettingsService(IAppDbContext db, INotificationService notifications, IListeningService listening, Auditor auditor) : IAdminSettingsService
{
    private const string NotificationsSummary = "Thông số thông báo";
    private const string ListeningSummary = "Thông số góc nghe";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AdminSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == NotificationConfig.SettingKey || s.Key == ListeningConfig.SettingKey)
            .ToDictionaryAsync(s => s.Key, s => s.UpdatedAt, ct);
        return new AdminSettingsDto(
            new AdminNotificationSettingsDto(await notifications.GetConfigAsync(ct), new NotificationConfig(),
                updated.TryGetValue(NotificationConfig.SettingKey, out var n) ? n : null),
            new AdminListeningSettingsDto(await listening.GetConfigAsync(ct), new ListeningConfig(),
                updated.TryGetValue(ListeningConfig.SettingKey, out var l) ? l : null));
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

    private async Task ApplyNotificationsAsync(NotificationConfig config, string action, CancellationToken ct)
    {
        var next = NotificationConfigRules.Normalize(config);
        var problems = NotificationConfigRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        await WriteAsync(NotificationConfig.SettingKey, NotificationsSummary, action, await notifications.GetConfigAsync(ct), next, ct);
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
