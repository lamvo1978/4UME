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
    int PracticeCount,
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

public static class GrammarDraftRules
{
    public const string TargetExercises = "exercises";
    public const string TargetPractice = "practice";
    public static readonly string[] Difficulties = ["easy", "mixed", "hard"];
    public const int MaxCount = 20;
}

/// <param name="Lesson">The lesson as currently edited (may be unsaved), so the AI sees the theory and avoids existing questions.</param>
/// <param name="Target"><see cref="GrammarDraftRules.TargetExercises"/> or <see cref="GrammarDraftRules.TargetPractice"/>; decides which types are allowed.</param>
/// <param name="SkipCheck">Skip the AI check pass: one AI call instead of two, the admin reads answers carefully.</param>
/// <param name="Provider">Null drafts with Groq then Gemini; otherwise one of <see cref="AiProviders"/>, used for both passes.</param>
public record GrammarDraftRequest(
    GrammarLessonDocument Lesson,
    string Target,
    int Count,
    IReadOnlyList<string>? Types,
    string? Difficulty,
    string? Notes,
    bool SkipCheck = false,
    string? Provider = null);

/// <param name="Warning">Set when the second AI pass doubts the answer; the admin should look closely before keeping it.</param>
public record GrammarDraftItemDto(GrammarExercise Exercise, IReadOnlyList<string> Problems, string? Warning);

/// <param name="Checked">False when the checking pass failed (e.g. rate limit), so no item carries a warning.</param>
/// <param name="Model">The AI model that wrote the draft.</param>
public record GrammarDraftDto(IReadOnlyList<GrammarDraftItemDto> Items, bool Checked, string Model);

public interface IGrammarDraftService
{
    Task<GrammarDraftDto> DraftAsync(GrammarDraftRequest request, CancellationToken ct = default);
}
