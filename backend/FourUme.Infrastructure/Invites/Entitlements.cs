using FourUme.Application.Abstractions;
using FourUme.Application.Invites;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Invites;

/// <summary>Premium and features from every source: the user's own end date and active partner codes.</summary>
public static class Entitlements
{
    public static async Task<AccessDto> GetAsync(IAppDbContext db, Guid userId, CancellationToken ct)
    {
        var until = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.PremiumUntil).FirstOrDefaultAsync(ct);
        var partners = await db.PartnerCodes.AsNoTracking()
            .Where(c => c.UsedById == userId && c.RevokedAt == null)
            .Select(c => new { c.Partner!.Name, c.Partner.Features })
            .ToListAsync(ct);
        var partnerName = partners.Count == 0 ? null : string.Join(", ", partners.Select(p => p.Name).Distinct());
        var features = partners.SelectMany(p => FeatureKeys.Parse(p.Features)).Distinct().ToList();
        return new AccessDto(until > DateTimeOffset.UtcNow || partnerName is not null, until, partnerName, features);
    }
}
