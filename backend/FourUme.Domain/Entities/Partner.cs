namespace FourUme.Domain.Entities;

/// <summary>An organisation (e.g. an English centre) whose students get Premium and extra features through one-time codes.</summary>
public class Partner
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    /// <summary>Two upper-case letters every code of this partner starts with; fixed once codes exist.</summary>
    public string Prefix { get; set; } = string.Empty;
    /// <summary>Comma-separated feature keys unlocked for the partner's students, e.g. "ielts".</summary>
    public string Features { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<PartnerCode> Codes { get; set; } = new List<PartnerCode>();
}

/// <summary>
/// A single-use code. Once redeemed, the user is the partner's student (Premium and the partner's features) until an
/// admin revokes the code or its batch expires. The student's own Premium is paused meanwhile.
/// </summary>
public class PartnerCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public Partner? Partner { get; set; }
    /// <summary>Partner prefix plus six digits, without the display dash.</summary>
    public string Code { get; set; } = string.Empty;
    /// <summary>Label for the generated batch, e.g. the class name.</summary>
    public string Batch { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>End of the batch (e.g. the course); null runs until revoked.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }
    /// <summary>Cleared when the account is deleted; <see cref="UsedAt"/> keeps the code spent.</summary>
    public Guid? UsedById { get; set; }
    public User? UsedBy { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    /// <summary>The student's own Premium time left when it was paused; given back once this code stops being active.</summary>
    public TimeSpan? HeldPremium { get; set; }
}
