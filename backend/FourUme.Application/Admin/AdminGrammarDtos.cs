using FourUme.Application.Grammar;

namespace FourUme.Application.Admin;

public record AdminGrammarSummaryDto(
    string Slug,
    string TitleVi,
    string? TitleEn,
    string Level,
    int SortOrder,
    bool Published,
    int QuizSize,
    int SectionCount,
    int ExerciseCount,
    int Version,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? EditedAt,
    int Learners);

/// <summary>The full lesson document plus admin-only facts; <c>Problems</c> lists what blocks publishing.</summary>
public record AdminGrammarDetailDto(
    GrammarLessonDocument Lesson,
    int Learners,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? EditedAt,
    IReadOnlyList<string> Problems);

public record GrammarValidationDto(IReadOnlyList<string> Problems);
