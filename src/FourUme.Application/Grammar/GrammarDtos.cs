namespace FourUme.Application.Grammar;

public record GrammarLessonSummaryDto(string Slug, string TitleVi, string Level, int ExerciseCount, int? BestScore);

public record GrammarExerciseDto(
    string Id,
    string Type,
    string Prompt,
    IReadOnlyList<string>? Options,
    string Explanation,
    string Answer);

public record GrammarLessonDetailDto(
    string Slug,
    string TitleVi,
    string Level,
    string SummaryVi,
    string Formula,
    string Example,
    string CommonMistakeVi,
    IReadOnlyList<GrammarExerciseDto> Exercises);

public record GrammarSubmitAnswer(string ExerciseId, string Answer);
public record GrammarSubmitRequest(IReadOnlyList<GrammarSubmitAnswer> Answers);
public record GrammarSubmitResultItem(string ExerciseId, bool Correct, string CorrectAnswer, string Explanation);
public record GrammarSubmitResponse(int Score, int Total, IReadOnlyList<GrammarSubmitResultItem> Results);
