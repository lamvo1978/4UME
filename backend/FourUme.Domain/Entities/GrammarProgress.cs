namespace FourUme.Domain.Entities;

public class GrammarProgress : IReviewable
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string LessonSlug { get; set; } = string.Empty;
    public int ReviewLevel { get; set; }
    public int LapseCount { get; set; }
    public DateTimeOffset? NextReviewAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
