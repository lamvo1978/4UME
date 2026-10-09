namespace FourUme.Domain.Entities;

/// <summary>One row per user per local calendar day with any study activity (or a day saved by a streak freeze).</summary>
public class StudyDay
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public int NewWords { get; set; }
    public int Reviews { get; set; }
    public int GrammarItems { get; set; }
    /// <summary>Listening pieces finished (only recorded while the admin lets listening count toward the streak).</summary>
    public int Listens { get; set; }
    public bool Frozen { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
