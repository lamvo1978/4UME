namespace FourUme.Application.Notifications;

/// <summary>Who a broadcast goes to; always only learners with "news" on, a registered phone and an unlocked account.</summary>
public static class BroadcastAudiences
{
    public const string All = "all";
    /// <summary>Studied in the last 7 days.</summary>
    public const string Active = "active";
    /// <summary>No study for <c>UserFilters.InactiveDays</c> days (or never), same as the users page filter.</summary>
    public const string Inactive = "inactive";
    public const string Premium = "premium";
    /// <summary>Current students of one partner centre.</summary>
    public const string Partner = "partner";

    public static readonly string[] Values = [All, Active, Inactive, Premium, Partner];
}

/// <summary>Screens the app can open from a broadcast; older app versions just open the app.</summary>
public static class BroadcastScreens
{
    public static readonly string[] Values = ["", "study", "practice", "listen", "invite"];
}

public static class BroadcastRules
{
    public const int MaxTitle = 90;
    public const int MaxBody = 180;
    /// <summary>People still waiting (quiet hours) this long after the start are skipped.</summary>
    public static readonly TimeSpan DeliveryWindow = TimeSpan.FromHours(24);
    public static readonly TimeSpan MaxScheduleAhead = TimeSpan.FromDays(30);
}

public record BroadcastContent(string Title, string Body, string Screen);

public record BroadcastAudienceRequest(string Audience, Guid? PartnerId);

/// <param name="ScheduledAt">Null sends now.</param>
public record CreateBroadcastRequest(string Title, string Body, string Screen, string Audience, Guid? PartnerId, DateTimeOffset? ScheduledAt);

/// <param name="Matching">Unlocked accounts in the group.</param>
/// <param name="Reachable">Those who will get it: "news" on and at least one phone registered.</param>
/// <param name="OptedOut">Have a phone but turned "news" off.</param>
/// <param name="NoDevice">Never allowed notifications on any phone (or logged out everywhere).</param>
public record BroadcastEstimate(int Matching, int Reachable, int OptedOut, int NoDevice);

/// <param name="Pending">Waiting for their quiet hours to end.</param>
/// <param name="Skipped">Still waiting when the delivery window closed, or the broadcast was cancelled.</param>
public record BroadcastDto(
    Guid Id,
    string Title,
    string Body,
    string Screen,
    string Audience,
    Guid? PartnerId,
    string? PartnerName,
    DateTimeOffset ScheduledAt,
    DateTimeOffset CreatedAt,
    string CreatedBy,
    string Status,
    DateTimeOffset? FinishedAt,
    int Recipients,
    int Sent,
    int Pending,
    int Failed,
    int Skipped,
    string? LastError);

public interface IBroadcastService
{
    Task<BroadcastEstimate> EstimateAsync(BroadcastAudienceRequest request, CancellationToken ct = default);
    /// <summary>Sends to the signed-in admin's own phones, ignoring quiet hours and switches.</summary>
    Task<PushResult> SendTestAsync(BroadcastContent content, CancellationToken ct = default);
    Task<BroadcastDto> CreateAsync(CreateBroadcastRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<BroadcastDto>> ListAsync(CancellationToken ct = default);
    /// <summary>Stops a scheduled broadcast, or the people still waiting in one being sent.</summary>
    Task<BroadcastDto> CancelAsync(Guid id, CancellationToken ct = default);
}
