namespace FourUme.Domain.Entities;

/// <summary>A push notification sent by the server; one per user, kind and local day.</summary>
public class NotificationLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>daily · rescue · comeback · freeze · weekly · news</summary>
    public string Kind { get; set; } = string.Empty;
    public DateOnly LocalDate { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>pending · sent · failed</summary>
    public string Status { get; set; } = "pending";
}
