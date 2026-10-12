namespace FourUme.Domain.Entities;

/// <summary>A new learner who joined with someone's invite code; both are rewarded once the invitee has studied enough days.</summary>
public class Referral
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InviterId { get; set; }
    public User? Inviter { get; set; }
    public Guid InviteeId { get; set; }
    public User? Invitee { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RewardedAt { get; set; }
    /// <summary>False when the inviter had already reached the reward cap; the invitee is rewarded either way.</summary>
    public bool InviterRewarded { get; set; }
}
