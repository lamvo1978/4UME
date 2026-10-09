namespace FourUme.Domain.Entities;

/// <summary>One-time code mailed to confirm an address; at most one live code per email and purpose.</summary>
public class EmailCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    /// <summary><see cref="EmailCodePurposes"/>.</summary>
    public string Purpose { get; set; } = string.Empty;
    /// <summary>Only the hash is stored so a database leak doesn't expose live codes.</summary>
    public string CodeHash { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    /// <summary>Codes sent within the current hour window, to cap how often one address can be mailed.</summary>
    public int SentInWindow { get; set; }
    public DateTimeOffset WindowStartedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class EmailCodePurposes
{
    public const string Register = "register";
    public const string ResetPassword = "reset-password";
}
