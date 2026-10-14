using System.Text.Json;

namespace FourUme.Application.Grammar;

public record GrammarLessonSummaryDto(
    string Slug,
    string TitleVi,
    string? TitleEn,
    string Level,
    int Order,
    int QuizSize,
    int? BestScore,
    int? BestTotal,
    int ReviewLevel,
    DateTimeOffset? NextReviewAt);

/// <summary>Sections and exercises are passed through as stored (docs/grammar-lesson-schema.md).</summary>
public record GrammarLessonDetailDto(
    string Slug,
    string TitleVi,
    string? TitleEn,
    string Level,
    string SummaryVi,
    int QuizSize,
    JsonElement Sections,
    JsonElement Exercises,
    int ReviewLevel);

public record GrammarCompleteRequest(int Score, int Total);

public record GrammarCompleteResponse(int Score, int Total, bool Passed, bool AddedToReview, DateTimeOffset? NextReviewAt);

/// <summary>A lesson with its whole exercise pool; the client samples a few questions, preferring <c>Practice</c>.</summary>
/// <param name="Level">Review level (0 = not in the review schedule).</param>
public record GrammarReviewItemDto(string Slug, string TitleVi, int Level, JsonElement Exercises, JsonElement Practice);

public static class GrammarMixedScopes
{
    /// <summary>Lessons the learner has already done at least once.</summary>
    public const string Learned = "learned";
    public const int MaxLessons = 10;
}

/// <param name="Mistakes">Wrong answers per lesson slug in a mixed session.</param>
public record GrammarMixedCompleteRequest(Dictionary<string, int> Mistakes);

/// <param name="Pulled">Lessons in review that went badly and were scheduled for tomorrow.</param>
public record GrammarMixedCompleteResponse(int Pulled);

/// <param name="Missing">Questions (across all lessons) whose verbs have no tense yet.</param>
public record GrammarVerbStatusDto(bool Configured, bool Running, int Done, int Total, string? Error, int Missing);

public record GrammarReviewAnswerRequest(string Slug, int Mistakes);

public record GrammarReviewAnswerResponse(
    string Slug,
    int Level,
    DateTimeOffset? NextReviewAt,
    bool SuggestRelearn,
    bool PulledForward);
