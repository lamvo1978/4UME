using FourUme.Application.Vocabulary;
using FourUme.Domain.Enums;

namespace FourUme.Application.Review;

/// <param name="WeakCount">Words listed under "Ôn từ hay sai" (see <see cref="WeakWords"/>); grammar leaves it at 0.</param>
public record ReviewSummaryDto(int DueCount, int InReview, int Mastered, DateTimeOffset? NextDueAt, int WeakCount = 0);

/// <summary>
/// Words and grammar lessons that will be due by the end of a local day if nothing is reviewed before then
/// (cumulative, overdue items included) — what a reminder for that day should mention.
/// </summary>
public record ReviewForecastDayDto(DateOnly Date, int Words, int Grammar);

/// <summary>
/// A due word plus multiple-choice options (correct answer included, shuffled).
/// The client builds the session's exercises from these.
/// </summary>
/// <param name="SpeakScore">Latest pronunciation score; only filled for "Ôn từ hay sai", which reads low-scoring words aloud.</param>
public record ReviewItemDto(
    int Level,
    WordDto Word,
    IReadOnlyList<string> WordOptions,
    IReadOnlyList<string> MeaningOptions,
    int? SpeakScore = null);

/// <summary>Sent once per word, after all of its exercises were finally answered correctly.</summary>
public record ReviewAnswerRequest(string WordId, int Mistakes);

/// <summary>Practice draws from words already marked "Đã nhớ"; weak words (low level or lapsed) come first.</summary>
/// <param name="Weak">Only words listed under "Ôn từ hay sai", most missed first.</param>
public record PracticeQuery(string? DeckId, IReadOnlyList<string>? WordIds, int Limit, bool Weak = false);

/// <param name="SpeakScore">Latest pronunciation score, if the word was ever checked.</param>
public record WeakWordDto(string WordId, string Word, string Ipa, string MeaningVi, int WeakScore, int? SpeakScore);

/// <summary>Practice never raises a level; a shaky word only gets its next review pulled forward.</summary>
public record PracticeAnswerResponse(string WordId, DateTimeOffset? NextReviewAt, bool PulledForward);

public record ReviewAnswerResponse(
    string WordId,
    int Level,
    WordStatus Status,
    DateTimeOffset? NextReviewAt,
    bool BackToLearning);
