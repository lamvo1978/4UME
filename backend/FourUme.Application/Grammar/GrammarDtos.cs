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

/// <summary>A lesson due for review with its whole exercise pool; the client samples a few questions.</summary>
public record GrammarReviewItemDto(string Slug, string TitleVi, int Level, JsonElement Exercises);

public record GrammarReviewAnswerRequest(string Slug, int Mistakes);

public record GrammarReviewAnswerResponse(
    string Slug,
    int Level,
    DateTimeOffset? NextReviewAt,
    bool SuggestRelearn,
    bool PulledForward);
