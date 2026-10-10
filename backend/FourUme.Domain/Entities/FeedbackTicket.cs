namespace FourUme.Domain.Entities;

/// <summary>A learner's feedback thread ("ticket"), answered by the admin in the web admin.</summary>
public class FeedbackTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>idea, bug, content or other.</summary>
    public string Category { get; set; } = "idea";
    /// <summary>Start of the first message, for lists and email subjects.</summary>
    public string Subject { get; set; } = string.Empty;
    /// <summary>open (waiting for the admin), answered (waiting for the learner) or closed.</summary>
    public string Status { get; set; } = "open";
    /// <summary>Word the learner reported from a word card, if any.</summary>
    public string? WordId { get; set; }
    public string? AppVersion { get; set; }
    public string? Platform { get; set; }
    public string? Device { get; set; }
    /// <summary>The admin replied and the learner hasn't opened the ticket since.</summary>
    public bool UserUnread { get; set; }
    /// <summary>The learner wrote and the admin hasn't opened the ticket since.</summary>
    public bool AdminUnread { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset LastMessageAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ClosedAt { get; set; }
    /// <summary>user, admin or auto (no reply from the learner for a while).</summary>
    public string? ClosedBy { get; set; }
    public ICollection<FeedbackMessage> Messages { get; set; } = new List<FeedbackMessage>();
}

public class FeedbackMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public FeedbackTicket Ticket { get; set; } = null!;
    public bool FromAdmin { get; set; }
    /// <summary>Admin display name for replies; null for the learner's messages.</summary>
    public string? AuthorName { get; set; }
    public string Body { get; set; } = string.Empty;
    /// <summary>Public paths of attached screenshots ("/media/feedback/….webp").</summary>
    public List<string> Images { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
