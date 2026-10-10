namespace FourUme.Domain.Entities;

/// <summary>One Azure pronunciation check; counts toward the learner's daily quota and the monthly audio budget.</summary>
public class PronunciationAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string WordId { get; set; } = string.Empty;
    /// <summary>The learner's calendar day when the check ran (quota resets at local midnight).</summary>
    public DateOnly LocalDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>Length of the audio sent to Azure (what the service bills).</summary>
    public int AudioMs { get; set; }
    public int Score { get; set; }
}
