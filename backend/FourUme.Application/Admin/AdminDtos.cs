namespace FourUme.Application.Admin;

public record AdminIdentityDto(Guid Id, string Email, string DisplayName, string Role);

/// <param name="Activity">The last <see cref="OverviewRules.ActivityDays"/> days, oldest first.</param>
public record AdminOverviewDto(
    int Words,
    int Decks,
    int GrammarLessons,
    int WordsMissingImage,
    int WordsMissingExample,
    int WordsMissingIpa,
    int Users,
    int ActiveUsers7Days,
    int ActiveToday,
    int NewUsers7Days,
    int Admins,
    int LockedUsers,
    IReadOnlyList<OverviewDayDto> Activity,
    IReadOnlyList<RecentUserDto> RecentUsers,
    IReadOnlyList<AuditEntryDto> RecentChanges);

/// <param name="Learners">Users with real study that day (streak-freeze days excluded).</param>
public record OverviewDayDto(DateOnly Date, int Learners, int NewUsers, int NewWords, int Reviews, int GrammarItems);

public record RecentUserDto(Guid Id, string DisplayName, string Email, DateTimeOffset CreatedAt);

public static class OverviewRules
{
    public const int ActivityDays = 14;
    public const int RecentItems = 6;
}
