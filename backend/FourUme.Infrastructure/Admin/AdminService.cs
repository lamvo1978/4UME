using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Auth;
using FourUme.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminService(IAppDbContext db, PasswordHasher<User> passwordHasher) : IAdminService
{
    public async Task<AdminIdentityDto?> GetAdminAsync(Guid userId, CancellationToken ct = default) =>
        await db.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.Role == UserRoles.Admin && u.LockedAt == null)
            .Select(u => new AdminIdentityDto(u.Id, u.Email, u.DisplayName, u.Role))
            .FirstOrDefaultAsync(ct);

    public async Task<int> EnsureAdminsAsync(IEnumerable<string> emails, CancellationToken ct = default)
    {
        var granted = await EnsureProtectedAdminsAsync(ct);
        var wanted = emails.Select(e => e.Trim().ToLowerInvariant()).Where(e => e.Length > 0).ToList();
        if (wanted.Count == 0) return granted;
        // Re-granting on every start would undo a revocation made in the admin.
        if (await db.Users.AnyAsync(u => u.Role == UserRoles.Admin, ct)) return granted;
        var users = await db.Users.Where(u => wanted.Contains(u.Email)).ToListAsync(ct);
        foreach (var u in users) u.Role = UserRoles.Admin;
        await db.SaveChangesAsync(ct);
        return granted + users.Count;
    }

    public async Task<int> CreateMissingOwnersAsync(string password, CancellationToken ct = default)
    {
        if (password.Length < UserSettingsRules.MinPasswordLength) return 0;
        var owners = AdminUserRules.ProtectedEmails.Select(e => e.ToLowerInvariant()).ToList();
        var existing = await db.Users.Select(u => u.Email).Where(e => owners.Contains(e)).ToListAsync(ct);
        var missing = owners.Except(existing).ToList();
        foreach (var email in missing)
        {
            var user = new User { Email = email, DisplayName = "Admin", Role = UserRoles.Admin };
            user.PasswordHash = passwordHasher.HashPassword(user, password);
            db.Users.Add(user);
        }
        await db.SaveChangesAsync(ct);
        return missing.Count;
    }

    /// <summary>Puts protected owner accounts back to admin + unlocked, in case they were changed directly in the database.</summary>
    private async Task<int> EnsureProtectedAdminsAsync(CancellationToken ct)
    {
        var protectedEmails = AdminUserRules.ProtectedEmails.Select(e => e.ToLowerInvariant()).ToList();
        var users = await db.Users
            .Where(u => protectedEmails.Contains(u.Email) && (u.Role != UserRoles.Admin || u.LockedAt != null))
            .ToListAsync(ct);
        foreach (var u in users)
        {
            u.Role = UserRoles.Admin;
            u.LockedAt = null;
        }
        await db.SaveChangesAsync(ct);
        return users.Count;
    }

    public async Task<AdminOverviewDto> GetOverviewAsync(DateOnly today, TimeSpan offset, CancellationToken ct = default)
    {
        var since7 = today.AddDays(-6);
        var from = today.AddDays(-(OverviewRules.ActivityDays - 1));
        var studied = db.StudyDays.AsNoTracking().Where(d => !d.Frozen);

        var days = await studied
            .Where(d => d.Date >= from)
            .GroupBy(d => d.Date)
            .Select(g => new { Date = g.Key, Learners = g.Count(), NewWords = g.Sum(d => d.NewWords), Reviews = g.Sum(d => d.Reviews), Grammar = g.Sum(d => d.GrammarItems) })
            .ToListAsync(ct);

        // Sign-ups are bucketed by the admin's local day; the window is padded by a day for the offset.
        var signupFrom = new DateTimeOffset(from.AddDays(-1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var signups = (await db.Users.AsNoTracking().Where(u => u.CreatedAt >= signupFrom).Select(u => u.CreatedAt).ToListAsync(ct))
            .Select(at => DateOnly.FromDateTime((at.UtcDateTime + offset)))
            .ToList();

        var activity = Enumerable.Range(0, OverviewRules.ActivityDays)
            .Select(i => from.AddDays(i))
            .Select(date =>
            {
                var d = days.FirstOrDefault(x => x.Date == date);
                return new OverviewDayDto(date, d?.Learners ?? 0, signups.Count(s => s == date), d?.NewWords ?? 0, d?.Reviews ?? 0, d?.Grammar ?? 0);
            })
            .ToList();

        var recentUsers = await db.Users.AsNoTracking()
            .OrderByDescending(u => u.CreatedAt)
            .Take(OverviewRules.RecentItems)
            .Select(u => new RecentUserDto(u.Id, u.DisplayName, u.Email, u.CreatedAt))
            .ToListAsync(ct);

        var recentChanges = (await db.AuditLogs.AsNoTracking()
                .OrderByDescending(l => l.At)
                .Take(OverviewRules.RecentItems)
                .ToListAsync(ct))
            .Select(AdminAuditService.ToDto)
            .ToList();

        return new AdminOverviewDto(
            await db.Words.CountAsync(ct),
            await db.Decks.CountAsync(ct),
            await db.GrammarLessons.CountAsync(ct),
            await db.Words.CountAsync(w => w.ImageUrl == null || w.ImageUrl == "", ct),
            await db.Words.CountAsync(w => w.Example == "", ct),
            await db.Words.CountAsync(w => w.Ipa == "", ct),
            await db.Users.CountAsync(ct),
            await studied.Where(d => d.Date >= since7).Select(d => d.UserId).Distinct().CountAsync(ct),
            await studied.CountAsync(d => d.Date == today, ct),
            signups.Count(s => s >= since7 && s <= today),
            await db.Users.CountAsync(u => u.Role == UserRoles.Admin && u.LockedAt == null, ct),
            await db.Users.CountAsync(u => u.LockedAt != null, ct),
            activity,
            recentUsers,
            recentChanges);
    }
}
