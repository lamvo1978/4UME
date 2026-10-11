namespace FourUme.Domain.Entities;

/// <summary>A rewarded ad the learner chose to watch; each adds one pronunciation check to that day.</summary>
public class AdReward
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>The learner's calendar day the extra check belongs to.</summary>
    public DateOnly LocalDate { get; set; }
    /// <summary>The ad network's id for the view; the same callback delivered twice is stored once.</summary>
    public string TransactionId { get; set; } = string.Empty;
    /// <summary>"admob", or "dev" for the simulated ad in development builds.</summary>
    public string Source { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
