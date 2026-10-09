namespace FourUme.Application.Admin;

public interface IAdminService
{
    /// <summary>The caller's identity if they are an unlocked admin; null otherwise. Checked on every admin request.</summary>
    Task<AdminIdentityDto?> GetAdminAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// First-run bootstrap: while no admin exists, grants the role to existing accounts with these emails.
    /// Once there is an admin, roles are managed only in the admin's user page.
    /// </summary>
    Task<int> EnsureAdminsAsync(IEnumerable<string> emails, CancellationToken ct = default);

    /// <summary>
    /// Fresh-server setup: creates the protected owner accounts that don't exist yet, with this password.
    /// Existing accounts (and their passwords) are never touched.
    /// </summary>
    Task<int> CreateMissingOwnersAsync(string password, CancellationToken ct = default);

    /// <param name="today">The admin's local date.</param>
    /// <param name="offset">The admin's UTC offset, used to bucket sign-ups by local day.</param>
    Task<AdminOverviewDto> GetOverviewAsync(DateOnly today, TimeSpan offset, CancellationToken ct = default);
}
