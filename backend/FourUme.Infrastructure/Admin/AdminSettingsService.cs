using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Notifications;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminSettingsService(IAppDbContext db, INotificationService notifications, Auditor auditor) : IAdminSettingsService
{
    private const string NotificationsSummary = "Thông số thông báo";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AdminSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var updatedAt = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == NotificationConfig.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminSettingsDto(new AdminNotificationSettingsDto(await notifications.GetConfigAsync(ct), new NotificationConfig(), updatedAt));
    }

    public async Task<AdminSettingsDto> SaveNotificationsAsync(NotificationConfig config, CancellationToken ct = default)
    {
        await ApplyAsync(config, AuditActions.Update, ct);
        return await GetAsync(ct);
    }

    public async Task<AdminSettingsDto> ResetNotificationsAsync(CancellationToken ct = default)
    {
        var before = await notifications.GetConfigAsync(ct);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == NotificationConfig.SettingKey, ct);
        if (row is not null) db.AppSettings.Remove(row);
        auditor.Record(AuditEntities.Settings, NotificationConfig.SettingKey, AuditActions.Update, NotificationsSummary, before, new NotificationConfig());
        await db.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    public Task RestoreNotificationsAsync(NotificationConfig config, CancellationToken ct = default) =>
        ApplyAsync(config, AuditActions.Restore, ct);

    private async Task ApplyAsync(NotificationConfig config, string action, CancellationToken ct)
    {
        var next = NotificationConfigRules.Normalize(config);
        var problems = NotificationConfigRules.Validate(next);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));

        var before = await notifications.GetConfigAsync(ct);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == NotificationConfig.SettingKey, ct);
        if (row is null)
        {
            row = new AppSetting { Key = NotificationConfig.SettingKey };
            db.AppSettings.Add(row);
        }
        row.Value = JsonSerializer.Serialize(next, Json);
        row.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Settings, NotificationConfig.SettingKey, action, NotificationsSummary, before, next);
        await db.SaveChangesAsync(ct);
    }
}
