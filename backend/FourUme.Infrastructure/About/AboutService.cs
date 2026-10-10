using System.Text.Json;
using FourUme.Application.About;
using FourUme.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.About;

public class AboutService(IAppDbContext db) : IAboutService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AboutContent> GetAsync(CancellationToken ct = default)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == AboutContent.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? AboutContent.Default() : JsonSerializer.Deserialize<AboutContent>(stored, Json) ?? AboutContent.Default();
    }
}
