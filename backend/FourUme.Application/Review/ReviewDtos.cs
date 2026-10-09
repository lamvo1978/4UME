using FourUme.Application.Vocabulary;
using FourUme.Domain.Enums;

namespace FourUme.Application.Review;

public record ReviewSummaryDto(int DueCount, int InReview, int Mastered, DateTimeOffset? NextDueAt);

/// <summary>
/// Words and grammar lessons that will be due by the end of a local day if nothing is reviewed before then
/// (cumulative, overdue items included) — what a reminder for that day should mention.
/// </summary>
public record ReviewForecastDayDto(DateOnly Date, int Words, int Grammar);

/// <summary>
/// A due word plus multiple-choice options (correct answer included, shuffled).
/// The client builds the session's exercises from these.
/// </summary>
public record ReviewItemDto(
    int Level,
    WordDto Word,
    IReadOnlyList<string> WordOptions,
    IReadOnlyList<string> MeaningOptions);

/// <summary>Sent once per word, after all of its exercises were finally answered correctly.</summary>
public record ReviewAnswerRequest(string WordId, int Mistakes);

/// <summary>Practice draws from words already marked "Đã nhớ"; weak words (low level or lapsed) come first.</summary>
public record PracticeQuery(string? DeckId, IReadOnlyList<string>? WordIds, int Limit);

/// <summary>Practice never raises a level; a shaky word only gets its next review pulled forward.</summary>
public record PracticeAnswerResponse(string WordId, DateTimeOffset? NextReviewAt, bool PulledForward);

public record ReviewAnswerResponse(
    string WordId,
    int Level,
    WordStatus Status,
    DateTimeOffset? NextReviewAt,
    bool BackToLearning);
