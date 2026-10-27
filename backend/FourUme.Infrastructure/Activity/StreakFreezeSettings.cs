using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Activity;

public class StreakFreezeSettings(IAppDbContext db) : IStreakFreezeSettings
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Task<StreakFreezeConfig> GetAsync(CancellationToken ct = default) => LoadAsync(db, ct);

    internal static async Task<StreakFreezeConfig> LoadAsync(IAppDbContext db, CancellationToken ct)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == StreakFreezeConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new StreakFreezeConfig() : JsonSerializer.Deserialize<StreakFreezeConfig>(stored, Json) ?? new StreakFreezeConfig();
    }
}
