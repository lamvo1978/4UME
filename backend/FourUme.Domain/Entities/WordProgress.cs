using FourUme.Domain.Enums;

namespace FourUme.Domain.Entities;

public class WordProgress : IReviewable
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string WordId { get; set; } = string.Empty;
    public WordStatus Status { get; set; } = WordStatus.New;
    public DateTimeOffset? NextReviewAt { get; set; }
    public int ReviewLevel { get; set; }
    public int LapseCount { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
