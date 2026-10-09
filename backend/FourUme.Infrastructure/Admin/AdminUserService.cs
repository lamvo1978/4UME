using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Admin;
using FourUme.Application.Auth;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using FourUme.Infrastructure.Activity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Net.Mail;

namespace FourUme.Infrastructure.Admin;

public class AdminUserService(
    IAppDbContext db,
    ICurrentAdmin current,
    Auditor auditor,
    IUserAccess access,
    PasswordHasher<User> passwordHasher) : IAdminUserService
{
    private const int MaxPageSize = 100;

    public async Task<PagedResult<AdminUserDto>> GetUsersAsync(AdminUserQuery query, DateOnly today, CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.PageSize, 1, MaxPageSize);
        var users = db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var q = $"%{query.Q.Trim()}%";
            users = users.Where(u => EF.Functions.ILike(u.Email, q) || EF.Functions.ILike(u.DisplayName, q));
        }

        var activeFrom = today.AddDays(-6);
        var inactiveFrom = today.AddDays(-(UserFilters.InactiveDays - 1));
        users = query.Filter switch
        {
            UserFilters.Admin => users.Where(u => u.Role == UserRoles.Admin),
            UserFilters.Locked => users.Where(u => u.LockedAt != null),
            UserFilters.Active => users.Where(u => u.StudyDays.Any(d => !d.Frozen && d.Date >= activeFrom)),
            UserFilters.Inactive => users.Where(u => !u.StudyDays.Any(d => !d.Frozen && d.Date >= inactiveFrom)),
            _ => users,
        };

        var rows = users.Select(u => new
        {
            u.Id,
            u.Email,
            u.DisplayName,
            u.Role,
            u.CreatedAt,
            u.LockedAt,
            LastStudy = u.StudyDays.Where(d => !d.Frozen).Max(d => (DateOnly?)d.Date),
            Known = u.WordProgresses.Count(p => p.Status == WordStatus.Known),
            Grammar = u.GrammarProgresses.Count(p => p.ReviewLevel > 0),
        });
        rows = query.Sort switch
        {
            "name" => rows.OrderBy(r => r.DisplayName).ThenBy(r => r.Email),
            // Postgres sorts NULL first in descending order, so never-studied users are pushed down explicitly.
            "active" => rows.OrderBy(r => r.LastStudy == null).ThenByDescending(r => r.LastStudy).ThenByDescending(r => r.CreatedAt),
            _ => rows.OrderByDescending(r => r.CreatedAt),
        };

        var total = await rows.CountAsync(ct);
        var items = await rows.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        var streaks = await StreaksAsync(items.Select(i => i.Id).ToList(), today, ct);

        return new PagedResult<AdminUserDto>(
            items.Select(r => new AdminUserDto(r.Id, r.Email, r.DisplayName, r.Role, r.CreatedAt, r.LockedAt, r.LastStudy,
                streaks.GetValueOrDefault(r.Id), r.Known, r.Grammar)).ToList(),
            total, page, size);
    }

    public async Task<AdminUserDetailDto?> GetUserAsync(Guid id, DateOnly today, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return null;

        var dates = (await db.StudyDays.AsNoTracking().Where(d => d.UserId == id).Select(d => d.Date).ToListAsync(ct)).ToHashSet();
        var from = today.AddDays(-(AdminUserRules.ActivityDays - 1));
        var days = await db.StudyDays.AsNoTracking()
            .Where(d => d.UserId == id && d.Date >= from)
            .OrderBy(d => d.Date)
            .Select(d => new StudyDayDto(d.Date, d.NewWords, d.Reviews, d.GrammarItems, d.Frozen, d.Listens))
            .ToListAsync(ct);
        var lastStudy = await db.StudyDays.AsNoTracking().Where(d => d.UserId == id && !d.Frozen).MaxAsync(d => (DateOnly?)d.Date, ct);
        var known = await db.WordProgresses.CountAsync(p => p.UserId == id && p.Status == WordStatus.Known, ct);
        var grammarPassed = await db.GrammarProgresses.CountAsync(p => p.UserId == id && p.ReviewLevel > 0, ct);

        return new AdminUserDetailDto(
            new AdminUserDto(user.Id, user.Email, user.DisplayName, user.Role, user.CreatedAt, user.LockedAt, lastStudy,
                ActivityService.CurrentStreak(dates, today), known, grammarPassed),
            Math.Max(user.BestStreak, ActivityService.LongestRun(dates)),
            user.StreakFreezes,
            await db.StudyDays.CountAsync(d => d.UserId == id && !d.Frozen, ct),
            await db.WordProgresses.CountAsync(p => p.UserId == id && p.Status == WordStatus.Hard, ct),
            await db.GrammarLessons.CountAsync(l => l.Published, ct),
            new AdminUserSettingsDto(user.DailyGoal, user.ReminderEnabled, user.ReminderTime, user.NotifyRescue, user.NotifyWeekly,
                user.NotifyNews, user.TimeZone),
            await db.DeviceTokens.AsNoTracking()
                .Where(d => d.UserId == id)
                .OrderByDescending(d => d.LastSeenAt)
                .Select(d => new AdminDeviceDto(d.Platform, d.AppVersion, d.CreatedAt, d.LastSeenAt))
                .ToListAsync(ct),
            days,
            user.Id == current.Id,
            AdminUserRules.IsProtected(user.Email));
    }

    public async Task<AdminUserDetailDto> CreateAsync(CreateUserRequest request, DateOnly today, CancellationToken ct = default)
    {
        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        var name = (request.DisplayName ?? "").Trim();
        if (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !email.Contains('.', StringComparison.Ordinal))
            throw new InvalidOperationException("Email không hợp lệ.");
        if (name.Length is < 1 or > 60) throw new InvalidOperationException("Tên hiển thị cần từ 1 đến 60 ký tự.");
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < UserSettingsRules.MinPasswordLength)
            throw new InvalidOperationException($"Mật khẩu cần tối thiểu {UserSettingsRules.MinPasswordLength} ký tự.");
        if (request.Role is not (UserRoles.Admin or UserRoles.User)) throw new InvalidOperationException("Quyền không hợp lệ.");
        if (await db.Users.AnyAsync(u => u.Email == email, ct)) throw new InvalidOperationException("Email đã được dùng.");

        var user = new User { Email = email, DisplayName = name, Role = request.Role };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        auditor.Record(AuditEntities.User, user.Id.ToString(), AuditActions.Create,
            $"Tạo tài khoản{(request.Role == UserRoles.Admin ? " quản trị" : "")}: {email}", null, Snapshot(user));
        await db.SaveChangesAsync(ct);
        return (await GetUserAsync(user.Id, today, ct))!;
    }

    public async Task<AdminUserDetailDto> SetRoleAsync(Guid id, string role, DateOnly today, CancellationToken ct = default)
    {
        if (role is not (UserRoles.Admin or UserRoles.User)) throw new InvalidOperationException("Quyền không hợp lệ.");
        var user = await FindForChangeAsync(id, ct);
        if (user.Role == role) return (await GetUserAsync(id, today, ct))!;
        if (role == UserRoles.Admin && user.LockedAt is not null)
            throw new InvalidOperationException("Tài khoản đang bị khoá. Mở khoá trước khi cấp quyền quản trị.");

        var before = Snapshot(user);
        user.Role = role;
        auditor.Record(AuditEntities.User, user.Id.ToString(), AuditActions.Update,
            $"{(role == UserRoles.Admin ? "Cấp" : "Thu")} quyền quản trị: {user.Email}", before, Snapshot(user));
        await db.SaveChangesAsync(ct);
        return (await GetUserAsync(id, today, ct))!;
    }

    public async Task<AdminUserDetailDto> SetLockedAsync(Guid id, bool locked, DateOnly today, CancellationToken ct = default)
    {
        var user = await FindForChangeAsync(id, ct);
        if ((user.LockedAt is not null) == locked) return (await GetUserAsync(id, today, ct))!;

        var before = Snapshot(user);
        user.LockedAt = locked ? DateTimeOffset.UtcNow : null;
        // A locked account loses admin rights too, so unlocking never silently restores them.
        if (locked) user.Role = UserRoles.User;
        auditor.Record(AuditEntities.User, user.Id.ToString(), AuditActions.Update,
            $"{(locked ? "Khoá" : "Mở khoá")} tài khoản: {user.Email}", before, Snapshot(user));
        await db.SaveChangesAsync(ct);
        access.Invalidate(user.Id);
        return (await GetUserAsync(id, today, ct))!;
    }

    /// <summary>Loads a user the caller may change: never themselves, so an admin can't lock themselves out.</summary>
    private async Task<User> FindForChangeAsync(Guid id, CancellationToken ct)
    {
        if (id == current.Id) throw new InvalidOperationException("Bạn không thể tự đổi quyền hoặc tự khoá tài khoản của mình.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw new KeyNotFoundException();
        if (AdminUserRules.IsProtected(user.Email))
            throw new InvalidOperationException("Đây là tài khoản quản trị gốc, không thể khoá hoặc thu quyền.");
        return user;
    }

    private static UserAccessSnapshot Snapshot(User u) => new(u.Email, u.DisplayName, u.Role, u.LockedAt is not null);

    private async Task<Dictionary<Guid, int>> StreaksAsync(List<Guid> ids, DateOnly today, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var rows = await db.StudyDays.AsNoTracking().Where(d => ids.Contains(d.UserId)).Select(d => new { d.UserId, d.Date }).ToListAsync(ct);
        return rows.GroupBy(r => r.UserId).ToDictionary(g => g.Key, g => ActivityService.CurrentStreak(g.Select(r => r.Date).ToHashSet(), today));
    }
}
