using FourUme.Application.Abstractions;
using FourUme.Application.Invites;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Invites;

/// <summary>Invite and partner codes share one shape and one input box, so every new code is checked against both.</summary>
public static class InviteCodes
{
    /// <summary>A free invite code with the prefix from the invite settings.</summary>
    public static async Task<string> NewReferralCodeAsync(IAppDbContext db, CancellationToken ct)
    {
        var config = await ReferralService.LoadConfigAsync(db, ct);
        var prefix = ReferralRules.NormalizePrefix(config.CodePrefix) ?? new ReferralConfig().CodePrefix;
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = ReferralRules.NewPrefixedCode(prefix);
            if (!await IsTakenAsync(db, code, ct)) return code;
        }
        throw new InvalidOperationException("Chưa tạo được mã mời, bạn thử lại sau nhé.");
    }

    public static async Task<bool> IsTakenAsync(IAppDbContext db, string code, CancellationToken ct) =>
        await db.Users.AnyAsync(u => u.ReferralCode == code, ct) || await db.PartnerCodes.AnyAsync(c => c.Code == code, ct);

    /// <summary>Codes in <paramref name="codes"/> already used by an invite or partner code.</summary>
    public static async Task<HashSet<string>> TakenAsync(IAppDbContext db, IReadOnlyCollection<string> codes, CancellationToken ct)
    {
        var taken = await db.PartnerCodes.Where(c => codes.Contains(c.Code)).Select(c => c.Code).ToListAsync(ct);
        taken.AddRange(await db.Users.Where(u => u.ReferralCode != null && codes.Contains(u.ReferralCode)).Select(u => u.ReferralCode!).ToListAsync(ct));
        return taken.ToHashSet();
    }
}
