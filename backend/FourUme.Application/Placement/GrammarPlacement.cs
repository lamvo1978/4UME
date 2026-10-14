namespace FourUme.Application.Placement;

public static class GrammarPlacementRules
{
    /// <summary>The app passes a level at 3 right and stops it at 2 wrong, so 4 questions always decide it.</summary>
    public const int QuestionsPerLevel = 4;
    /// <summary>Levels with fewer published questions are left out of the test.</summary>
    public const int MinPerLevel = QuestionsPerLevel;
    public const int MinOptions = 3;
    public const int MaxOptions = 4;
    public const int MaxPromptLength = 300;
    public const int MaxDraftCount = 20;

    public static List<string> Validate(SavePlacementGrammarRequest q)
    {
        var errors = new List<string>();
        if (PlacementRules.Rank(q.Level) < 0) errors.Add("Cấp độ phải là A1, A2, B1 hoặc B2.");
        if (string.IsNullOrWhiteSpace(q.Prompt)) errors.Add("Thiếu câu hỏi.");
        else if (q.Prompt.Length > MaxPromptLength) errors.Add($"Câu hỏi dài quá {MaxPromptLength} ký tự.");
        var options = q.Options ?? [];
        if (options.Count < MinOptions || options.Count > MaxOptions) errors.Add($"Cần {MinOptions}–{MaxOptions} lựa chọn.");
        if (options.Any(string.IsNullOrWhiteSpace)) errors.Add("Có lựa chọn bị trống.");
        if (options.Distinct(StringComparer.OrdinalIgnoreCase).Count() != options.Count) errors.Add("Các lựa chọn bị trùng nhau.");
        if (string.IsNullOrWhiteSpace(q.Answer) || !options.Contains(q.Answer)) errors.Add("Đáp án phải là một trong các lựa chọn.");
        return errors;
    }
}

/// <param name="Answer">Index of the correct option; like the vocabulary part, the test only steers the learner's own suggestion.</param>
public record PlacementGrammarQuestionDto(Guid Id, string Prompt, IReadOnlyList<string> Options, int Answer, string? LessonSlug);
public record PlacementGrammarLevelDto(string Level, IReadOnlyList<PlacementGrammarQuestionDto> Questions);

public record AdminPlacementGrammarDto(
    Guid Id,
    string Level,
    string Prompt,
    IReadOnlyList<string> Options,
    string Answer,
    string ExplanationVi,
    string? LessonSlug,
    bool Published,
    DateTimeOffset UpdatedAt);

public record SavePlacementGrammarRequest(
    string Level,
    string Prompt,
    List<string> Options,
    string Answer,
    string? ExplanationVi,
    string? LessonSlug,
    bool Published = true);

public record SavePlacementGrammarBatchRequest(List<SavePlacementGrammarRequest> Questions);

/// <param name="LessonSlug">Only write about this lesson; otherwise spread over the level's lessons.</param>
/// <param name="SkipCheck">Skip the AI check pass: one AI call instead of two, the admin reads answers carefully.</param>
public record PlacementGrammarDraftRequest(string Level, int Count, string? LessonSlug, string? Notes, bool SkipCheck = false, string? Provider = null);
public record PlacementGrammarDraftItemDto(SavePlacementGrammarRequest Question, IReadOnlyList<string> Problems, string? Warning);
/// <param name="Checked">False when the AI check pass failed, so missing warnings mean nothing.</param>
/// <param name="Model">The AI model that wrote the draft.</param>
public record PlacementGrammarDraftDto(IReadOnlyList<PlacementGrammarDraftItemDto> Items, bool Checked, string Model);

/// <summary>One question in an export file; without <paramref name="Id"/> the import creates it, with one it updates that question.</summary>
public record PlacementGrammarFileItem(
    Guid? Id,
    string Level,
    string Prompt,
    List<string> Options,
    string Answer,
    string? ExplanationVi,
    string? LessonSlug,
    bool Published = true);

/// <param name="Commit">False only previews what would change.</param>
public record ImportPlacementGrammarRequest(List<PlacementGrammarFileItem> Questions, bool Commit);
/// <param name="Line">1-based position in the file.</param>
public record ImportPlacementGrammarRow(int Line, Guid? Id, string Level, string Prompt, string Status, IReadOnlyList<string> Problems);
public record ImportPlacementGrammarResult(int Created, int Updated, int Unchanged, int Errors, bool Committed, IReadOnlyList<ImportPlacementGrammarRow> Rows);

public interface IAdminPlacementService
{
    Task<IReadOnlyList<PlacementGrammarFileItem>> ExportGrammarAsync(CancellationToken ct = default);
    Task<ImportPlacementGrammarResult> ImportGrammarAsync(ImportPlacementGrammarRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<AdminPlacementGrammarDto>> GetGrammarAsync(CancellationToken ct = default);
    Task<AdminPlacementGrammarDto> CreateGrammarAsync(SavePlacementGrammarRequest request, CancellationToken ct = default);
    Task<int> CreateGrammarBatchAsync(SavePlacementGrammarBatchRequest request, CancellationToken ct = default);
    Task<AdminPlacementGrammarDto> UpdateGrammarAsync(Guid id, SavePlacementGrammarRequest request, CancellationToken ct = default);
    Task DeleteGrammarAsync(Guid id, CancellationToken ct = default);
    Task<PlacementGrammarDraftDto> DraftGrammarAsync(PlacementGrammarDraftRequest request, CancellationToken ct = default);
}
