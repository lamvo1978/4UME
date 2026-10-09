namespace FourUme.Application.Activity;

public enum ActivityKind
{
    /// <summary>A word marked "Đã nhớ" for the first time — counts toward the daily goal.</summary>
    NewWord,
    /// <summary>Studied without a counter (e.g. a word postponed to "Học sau").</summary>
    Studied,
    Review,
    Grammar,
    /// <summary>Finished a listening piece (recorded only while the admin lets it count).</summary>
    Listening,
}

public record StudyDayDto(DateOnly Date, int NewWords, int Reviews, int GrammarItems, bool Frozen, int Listens = 0);

public record StreakDto(
    int Current,
    int Best,
    int Freezes,
    int MaxFreezes,
    bool StudiedToday,
    int TodayNewWords,
    int TodayReviews,
    int TodayGrammar,
    int DailyGoal,
    int? NextMilestone,
    DateOnly Today,
    /// <summary>Most recent day with real activity (freeze-covered days excluded).</summary>
    DateOnly? LastStudyDate,
    IReadOnlyList<StudyDayDto> Days);

/// <summary>Counts per review level, index 0 = level 1 … index 5 = level 6 (mastered).</summary>
public record MemoryDto(IReadOnlyList<int> Levels, int Learning, IReadOnlyList<CefrProgressDto> ByLevel);

public record CefrProgressDto(string Level, int Done, int Total);

public record StatsDto(StreakDto Streak, MemoryDto Vocabulary, MemoryDto Grammar, int TotalStudyDays, DateTimeOffset MemberSince);
