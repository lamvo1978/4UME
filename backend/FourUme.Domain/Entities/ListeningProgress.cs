namespace FourUme.Domain.Entities;

public class ListeningProgress
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string LessonSlug { get; set; } = string.Empty;
    /// <summary>Where to resume.</summary>
    public int PositionMs { get; set; }
    /// <summary>First time the learner listened (nearly) to the end.</summary>
    public DateTimeOffset? CompletedAt { get; set; }
    public int TimesCompleted { get; set; }
    public bool Liked { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
