namespace FourUme.Domain.Entities;

public enum ListeningLogKind
{
    /// <summary>Listened to a piece to the end.</summary>
    Listen,
    /// <summary>Checked one dictation line.</summary>
    Dictation,
}

/// <summary>
/// One listening event on the learner's local calendar, kept whether or not listening counts toward the streak
/// (StudyDays only sees it when it does), so the weekly summary can always count it.
/// </summary>
public class ListeningLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateOnly LocalDate { get; set; }
    public string LessonSlug { get; set; } = string.Empty;
    public ListeningLogKind Kind { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
