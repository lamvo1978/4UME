namespace FourUme.Domain.Entities;

/// <summary>
/// A "news" push an admin sends to a group of learners. Recipients are fixed when sending starts; each is delivered
/// outside their quiet hours, and those still waiting a day later are dropped.
/// </summary>
public class Broadcast
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    /// <summary>Screen the app opens on tap (see <c>BroadcastScreens</c>); empty opens the app as it was.</summary>
    public string Screen { get; set; } = string.Empty;
    /// <summary>See <c>BroadcastAudiences</c>.</summary>
    public string Audience { get; set; } = string.Empty;
    /// <summary>Set when <see cref="Audience"/> is the students of one partner.</summary>
    public Guid? PartnerId { get; set; }
    public Partner? Partner { get; set; }
    public DateTimeOffset ScheduledAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;
    /// <summary>scheduled · sending · done · cancelled</summary>
    public string Status { get; set; } = BroadcastStatuses.Scheduled;
    public DateTimeOffset? FinishedAt { get; set; }
    /// <summary>Last error Expo reported, to show in the history.</summary>
    public string? LastError { get; set; }

    public ICollection<BroadcastRecipient> Recipients { get; set; } = new List<BroadcastRecipient>();
}

public class BroadcastRecipient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BroadcastId { get; set; }
    public Broadcast Broadcast { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>pending · sending · sent · failed · expired · cancelled</summary>
    public string Status { get; set; } = BroadcastStatuses.Pending;
    /// <summary>Marks the rows one run took, so two runs never send to the same person.</summary>
    public Guid? ClaimId { get; set; }
    /// <summary>A claim left "sending" by a run that stopped half-way is retried after a while.</summary>
    public DateTimeOffset? ClaimedAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
}

public static class BroadcastStatuses
{
    public const string Scheduled = "scheduled";
    public const string Sending = "sending";
    public const string Done = "done";
    public const string Cancelled = "cancelled";

    public const string Pending = "pending";
    public const string Sent = "sent";
    public const string Failed = "failed";
    public const string Expired = "expired";
}
