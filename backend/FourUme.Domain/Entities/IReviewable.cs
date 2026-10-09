namespace FourUme.Domain.Entities;

/// <summary>Anything scheduled with spaced repetition (words, grammar lessons).</summary>
public interface IReviewable
{
    /// <summary>0 = not in review; 1..5 = spaced-repetition box; 6 = mastered.</summary>
    int ReviewLevel { get; set; }
    /// <summary>Consecutive review sessions with too many mistakes.</summary>
    int LapseCount { get; set; }
    DateTimeOffset? NextReviewAt { get; set; }
    DateTimeOffset UpdatedAt { get; set; }
}
