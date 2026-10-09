using FourUme.Domain.Entities;

namespace FourUme.Application.Review;

public enum ReviewOutcome
{
    LevelUp,
    Kept,
    Lapsed,
    /// <summary>Too many lapses in a row; the caller decides what "learn again" means.</summary>
    Relearn,
}

public static class ReviewSchedule
{
    public const int FirstLevel = 1;
    public const int MasteredLevel = 6;
    public const int LapsesBeforeRelearn = 2;
    /// <summary>A session with this many mistakes on an item keeps its level; more counts as forgotten.</summary>
    public const int MistakesTolerated = 1;
    /// <summary>Items at or below this level count as weak and are practiced first.</summary>
    public const int WeakLevel = 2;

    private static readonly int[] IntervalDays = [0, 1, 3, 7, 14, 30, 60];

    public static DateTimeOffset NextReviewAt(int level, DateTimeOffset now) =>
        now.AddDays(IntervalDays[Math.Clamp(level, FirstLevel, MasteredLevel)]);

    /// <summary>Puts an item into review at level 1 (first review tomorrow).</summary>
    public static void Start(IReviewable item, DateTimeOffset now)
    {
        item.ReviewLevel = FirstLevel;
        item.LapseCount = 0;
        item.NextReviewAt = NextReviewAt(FirstLevel, now);
        item.UpdatedAt = now;
    }

    /// <summary>Scheduled review: 0 mistakes → up a level, 1 → same level tomorrow, more → back to level 1.</summary>
    public static ReviewOutcome ApplyAnswer(IReviewable item, int mistakes, DateTimeOffset now)
    {
        item.UpdatedAt = now;
        if (mistakes <= 0)
        {
            item.ReviewLevel = Math.Min(item.ReviewLevel + 1, MasteredLevel);
            item.LapseCount = 0;
            item.NextReviewAt = NextReviewAt(item.ReviewLevel, now);
            return ReviewOutcome.LevelUp;
        }
        if (mistakes <= MistakesTolerated)
        {
            item.NextReviewAt = NextReviewAt(FirstLevel, now);
            return ReviewOutcome.Kept;
        }
        if (item.LapseCount + 1 >= LapsesBeforeRelearn)
        {
            item.LapseCount = 0;
            item.ReviewLevel = FirstLevel;
            item.NextReviewAt = NextReviewAt(FirstLevel, now);
            return ReviewOutcome.Relearn;
        }
        item.LapseCount++;
        item.ReviewLevel = FirstLevel;
        item.NextReviewAt = NextReviewAt(FirstLevel, now);
        return ReviewOutcome.Lapsed;
    }

    /// <summary>Extra practice never raises a level; a shaky item only has its next review pulled to tomorrow.</summary>
    public static bool ApplyPractice(IReviewable item, int mistakes, DateTimeOffset now)
    {
        var soon = NextReviewAt(FirstLevel, now);
        if (mistakes <= MistakesTolerated || (item.NextReviewAt is not null && item.NextReviewAt <= soon)) return false;
        item.NextReviewAt = soon;
        item.UpdatedAt = now;
        return true;
    }
}
