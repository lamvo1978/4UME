using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Feedback;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Feedback;

public class FeedbackSettingsService(IAppDbContext db) : IFeedbackSettingsService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<FeedbackSettings> GetAsync(CancellationToken ct = default)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == FeedbackSettings.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? FeedbackSettings.Default() : JsonSerializer.Deserialize<FeedbackSettings>(stored, Json) ?? FeedbackSettings.Default();
    }
}
