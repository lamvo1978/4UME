using FourUme.Application.Activity;

namespace FourUme.Application.Admin;

public static class UserFilters
{
    public const string Admin = "admin";
    public const string Locked = "locked";
    /// <summary>Studied in the last 7 days.</summary>
    public const string Active = "active";
    /// <summary>No study in the last 14 days (or never).</summary>
    public const string Inactive = "inactive";
    public const string Premium = "premium";
    public const int InactiveDays = 14;
}

/// <param name="Filter">See <see cref="UserFilters"/>; empty = everyone.</param>
/// <param name="Sort">"new" (default), "active" (last study first) or "name".</param>
public record AdminUserQuery(string? Q, string? Filter, string? Sort, int Page = 1, int PageSize = 30);

public record AdminUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    string Role,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LockedAt,
    DateOnly? LastStudyDate,
    int CurrentStreak,
    int KnownWords,
    int GrammarPassed,
    DateTimeOffset? PremiumUntil);

public record AdminUserSettingsDto(
    int DailyGoal,
    bool ReminderEnabled,
    string ReminderTime,
    bool NotifyRescue,
    bool NotifyWeekly,
    bool NotifyNews,
    string? TimeZone);

public record AdminDeviceDto(string Platform, string? AppVersion, DateTimeOffset CreatedAt, DateTimeOffset LastSeenAt);

/// <param name="Days">Study days of the last <see cref="AdminUserRules.ActivityDays"/> days, oldest first.</param>
public record AdminUserDetailDto(
    AdminUserDto User,
    int BestStreak,
    int StreakFreezes,
    int TotalStudyDays,
    int HardWords,
    int GrammarTotal,
    AdminUserSettingsDto Settings,
    IReadOnlyList<AdminDeviceDto> Devices,
    IReadOnlyList<StudyDayDto> Days,
    bool IsSelf,
    bool IsProtected);

public static class AdminUserRules
{
    public const int ActivityDays = 84;

    /// <summary>Owner accounts that can never be locked or lose admin rights, so the admin can't be taken over or emptied.</summary>
    public static readonly IReadOnlySet<string> ProtectedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "admin@4ume.io.vn",
    };

    public static bool IsProtected(string email) => ProtectedEmails.Contains(email);
}

/// <param name="Role">"admin" for a staff account, "user" for a learner.</param>
public record CreateUserRequest(string Email, string DisplayName, string Password, string Role);
public record SetRoleRequest(string Role);
public record SetLockRequest(bool Locked);
/// <param name="Until">End of Premium; null removes it.</param>
public record SetPremiumRequest(DateTimeOffset? Until);

/// <summary>What the history stores for a user change (no personal data beyond what the list shows).</summary>
public record UserAccessSnapshot(string Email, string DisplayName, string Role, bool Locked, DateTimeOffset? PremiumUntil = null);

public interface IAdminUserService
{
    Task<PagedResult<AdminUserDto>> GetUsersAsync(AdminUserQuery query, DateOnly today, CancellationToken ct = default);
    Task<AdminUserDetailDto?> GetUserAsync(Guid id, DateOnly today, CancellationToken ct = default);
    Task<AdminUserDetailDto> CreateAsync(CreateUserRequest request, DateOnly today, CancellationToken ct = default);
    Task<AdminUserDetailDto> SetRoleAsync(Guid id, string role, DateOnly today, CancellationToken ct = default);
    Task<AdminUserDetailDto> SetLockedAsync(Guid id, bool locked, DateOnly today, CancellationToken ct = default);
    Task<AdminUserDetailDto> SetPremiumAsync(Guid id, DateTimeOffset? until, DateOnly today, CancellationToken ct = default);
}

/// <summary>Whether a signed-in account may still use the API (exists and is not locked); cached briefly per user.</summary>
public interface IUserAccess
{
    Task<bool> IsActiveAsync(Guid userId, CancellationToken ct = default);
    void Invalidate(Guid userId);
}
