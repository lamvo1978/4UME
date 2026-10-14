using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Premium;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Premium;

public class PremiumPerksService(IAppDbContext db) : IPremiumPerksService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<PremiumPerks> GetAsync(CancellationToken ct = default)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == PremiumPerks.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        var perks = stored is null ? null : JsonSerializer.Deserialize<PremiumPerks>(stored, Json);
        if (perks is null) return PremiumPerks.Default();
        // Saved before the price list existed.
        return perks.Plans is null ? perks with { Plans = PremiumPerks.DefaultPlans() } : perks;
    }
}
