namespace FourUme.Domain.Entities;

public class GrammarAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string LessonSlug { get; set; } = string.Empty;
    public int Score { get; set; }
    public int Total { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
