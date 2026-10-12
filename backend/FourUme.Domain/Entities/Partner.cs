namespace FourUme.Domain.Entities;

/// <summary>An organisation (e.g. an English centre) whose students get Premium and extra features through one-time codes.</summary>
public class Partner
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    /// <summary>Comma-separated feature keys unlocked for the partner's students, e.g. "ielts".</summary>
    public string Features { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<PartnerCode> Codes { get; set; } = new List<PartnerCode>();
}

/// <summary>
/// A single-use code. Once redeemed, the user is the partner's student (Premium with no end date) until an admin
/// revokes the code.
/// </summary>
public class PartnerCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public Partner? Partner { get; set; }
    /// <summary>Upper-case letters and digits without the display dash.</summary>
    public string Code { get; set; } = string.Empty;
    /// <summary>Label for the generated batch, e.g. the class name.</summary>
    public string Batch { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>Cleared when the account is deleted; <see cref="UsedAt"/> keeps the code spent.</summary>
    public Guid? UsedById { get; set; }
    public User? UsedBy { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
