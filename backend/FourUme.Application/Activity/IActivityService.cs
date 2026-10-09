namespace FourUme.Application.Activity;

/// <summary>The user's local calendar date (the API derives it from the client's UTC offset).</summary>
public interface IClientClock
{
    DateOnly Today { get; }
    TimeSpan Offset { get; }
}

public interface IActivityService
{
    /// <summary>Marks today as studied; never throws so the main action is not affected.</summary>
    Task RecordAsync(Guid userId, ActivityKind kind, CancellationToken ct = default);

    Task<StreakDto> GetStreakAsync(Guid userId, CancellationToken ct = default);

    Task<StatsDto> GetStatsAsync(Guid userId, CancellationToken ct = default);
}

public static class StreakRules
{
    public const int MaxFreezes = 2;
    /// <summary>A freeze is earned every time the streak reaches a multiple of this.</summary>
    public const int FreezeEvery = 7;
    public const int HistoryDays = 35;

    public static readonly int[] Milestones = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000];

    public static int? NextMilestone(int current) =>
        Milestones.Cast<int?>().FirstOrDefault(m => m > current);
}
