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
    /// <summary>Raised by mistakes, lowered by clean answers (review and practice); above 0 the word is under "Ôn từ hay sai".</summary>
    public int WeakScore { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>Marked known by the placement test rather than studied; cleared once the learner studies or reviews the word.</summary>
    public bool FromPlacement { get; set; }
}
