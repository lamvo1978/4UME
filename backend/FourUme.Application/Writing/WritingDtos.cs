using FourUme.Application.Admin;

namespace FourUme.Application.Writing;

/// <summary>System-wide options for "Luyện viết với AI", stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record WritingConfig
{
    public const string SettingKey = "writing";

    public bool Enabled { get; init; } = true;
    /// <summary>Paragraphs a learner may have graded per day without Premium.</summary>
    public int FreeDailyChecks { get; init; } = 1;
    public int PremiumDailyChecks { get; init; } = 10;
    /// <summary>Gradings per UTC day for everyone together, to stay inside the free AI quotas; 0 = no cap.</summary>
    public int DailyTotalCap { get; init; } = 60;
    /// <summary>Share of <see cref="DailyTotalCap"/> kept for Premium: free learners stop at the rest.</summary>
    public int PremiumReservePercent { get; init; } = 30;
    /// <summary>Free learners see only the first sentence of the AI's rewrite.</summary>
    public bool RewritePremiumOnly { get; init; } = true;
    /// <summary>Most recent paragraphs a free learner can open again; Premium sees all.</summary>
    public int FreeHistoryCount { get; init; } = 5;
    /// <summary>AI providers tried in order (see <see cref="AiProviders"/>); unconfigured ones are skipped.</summary>
    public List<string> Providers { get; init; } = [AiProviders.Groq, AiProviders.Mistral];
    /// <summary>Order for Premium learners; empty uses <see cref="Providers"/>.</summary>
    public List<string> PremiumProviders { get; init; } = [];
}

public static class WritingRules
{
    public static readonly string[] Levels = ["A1", "A2", "B1", "B2"];
    public static readonly string[] AllowedProviders = [AiProviders.Mistral, AiProviders.Groq, AiProviders.Gemini];
    public const int MaxLimit = 1000;
    public const int MaxDailyCap = 100_000;
    public const int MaxHistory = 1000;
    /// <summary>About 250 words; the per-minute token limits of the free AI tiers leave no room for longer texts.</summary>
    public const int MaxText = 1500;
    public const int MinWords = 10;
    public const int MaxTopic = 120;
    public const int MaxTitle = 80;
    public const int MaxPromptEn = 600;
    public const int MaxGuide = 300;
    public const int MaxPhrases = 8;
    public const int MaxPhrase = 60;
    public const int MaxIcon = 40;
    public const int MaxDraftCount = 10;
    public const int MaxCorrections = 15;
    public const int MaxUpgrades = 5;
    public const string DefaultIcon = "create-outline";

    /// <summary>Suggested length per level when a prompt doesn't set one (and for free writing).</summary>
    public static (int Min, int Max) WordRange(string level) => level switch
    {
        "A1" => (30, 80),
        "A2" => (50, 120),
        "B1" => (80, 180),
        _ => (120, 250),
    };

    public static int CountWords(string text) =>
        text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Count(w => w.Any(char.IsLetterOrDigit));

    public static IReadOnlyList<string> Validate(WritingConfig c)
    {
        var problems = new List<string>();
        if (c.FreeDailyChecks is < 0 or > MaxLimit) problems.Add($"Bài miễn phí mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.PremiumDailyChecks is < 0 or > MaxLimit) problems.Add($"Bài Premium mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.DailyTotalCap is < 0 or > MaxDailyCap) problems.Add($"Trần tổng mỗi ngày phải từ 0 đến {MaxDailyCap}.");
        if (c.PremiumReservePercent is < 0 or > 100) problems.Add("Phần để dành cho Premium phải từ 0 đến 100%.");
        if (c.FreeHistoryCount is < 0 or > MaxHistory) problems.Add($"Số bài lịch sử miễn phí phải từ 0 đến {MaxHistory}.");
        if ((c.Providers ?? []).Count == 0) problems.Add("Cần ít nhất một AI chấm bài.");
        if ((c.Providers ?? []).Concat(c.PremiumProviders ?? []).Any(p => !AllowedProviders.Contains(p)))
            problems.Add("AI chấm bài không hợp lệ.");
        return problems;
    }

    public static List<string> Validate(SaveWritingPromptRequest p)
    {
        var errors = new List<string>();
        if (!Levels.Contains(p.Level)) errors.Add("Cấp độ phải là A1, A2, B1 hoặc B2.");
        Required(errors, p.TitleVi, MaxTitle, "Tiêu đề");
        Required(errors, p.PromptEn, MaxPromptEn, "Đề bài");
        if ((p.GuideVi ?? "").Length > MaxGuide) errors.Add($"Hướng dẫn tối đa {MaxGuide} ký tự.");
        if ((p.Icon ?? "").Length > MaxIcon) errors.Add("Tên biểu tượng quá dài.");
        if (p.MinWords is < 0 or > 400 || p.MaxWords is < 0 or > 400) errors.Add("Số từ phải từ 0 đến 400.");
        else if (p.MinWords > 0 && p.MaxWords > 0 && p.MinWords > p.MaxWords) errors.Add("Số từ tối thiểu lớn hơn tối đa.");
        var phrases = p.KeyPhrases ?? [];
        if (phrases.Count > MaxPhrases) errors.Add($"Tối đa {MaxPhrases} cụm từ gợi ý.");
        if (phrases.Any(x => x.Length > MaxPhrase)) errors.Add($"Mỗi cụm từ gợi ý tối đa {MaxPhrase} ký tự.");
        return errors;
    }

    private static void Required(List<string> errors, string? value, int max, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) errors.Add($"Thiếu {label.ToLowerInvariant()}.");
        else if (value.Length > max) errors.Add($"{label} tối đa {max} ký tự.");
    }

    /// <summary>Same title ignoring case and spacing, to spot duplicates.</summary>
    public static string Key(string title) =>
        new string(title.ToLowerInvariant().Where(c => char.IsLetterOrDigit(c) || c == ' ').ToArray()).Trim();
}

/// <param name="Available">False when no AI provider in the chain is configured on the server.</param>
/// <param name="Remaining">Paragraphs left today on the learner's plan; 0 also when the feature is off.</param>
/// <param name="DayFull">Everyone's gradings today reached the share open to this learner's plan.</param>
public record WritingStatusDto(
    bool Enabled,
    bool Available,
    bool Premium,
    int DailyLimit,
    int UsedToday,
    int Remaining,
    int FreeDailyLimit,
    int PremiumDailyLimit,
    bool RewritePremiumOnly,
    int FreeHistoryCount,
    bool DayFull);

public record WritingPromptDto(Guid Id, string Level, string TitleVi, string Icon, string PromptEn, string GuideVi, int MinWords, int MaxWords,
    IReadOnlyList<string> KeyPhrases);

/// <param name="PromptId">Null for free writing (then <paramref name="Level"/> and optionally <paramref name="Topic"/>).</param>
/// <param name="ParentId">The earlier submission this text rewrites.</param>
public record SubmitWritingRequest(Guid? PromptId, string? Level, string? Topic, string Text, Guid? ParentId);

public static class WritingCorrectionKinds
{
    public const string Grammar = "grammar";
    public const string Word = "word";
    public const string Spelling = "spelling";
    public const string Punctuation = "punctuation";
    public const string Style = "style";
    public static readonly string[] All = [Grammar, Word, Spelling, Punctuation, Style];
}

/// <param name="Start">Position of <paramref name="Original"/> in the learner's text; -1 when the AI quoted it inexactly.</param>
public record WritingCorrectionDto(string Original, string Corrected, string ExplainVi, string Kind, int Start);

/// <summary>Each 0–100.</summary>
public record WritingScoresDto(int Grammar, int Vocabulary, int Coherence, int Task);

public record WritingUpgradeDto(string En, string Vi, string WhyVi);

/// <param name="Rewrite">The AI's natural version; null when locked for a free learner.</param>
/// <param name="RewritePreview">First sentence of the rewrite, shown above the lock.</param>
public record WritingResultDto(
    int Score,
    WritingScoresDto Scores,
    string FeedbackVi,
    IReadOnlyList<WritingCorrectionDto> Corrections,
    string? Rewrite,
    bool RewriteLocked,
    string RewritePreview,
    IReadOnlyList<WritingUpgradeDto> Upgrades);

public record WritingSubmissionDto(
    Guid Id,
    Guid? PromptId,
    string? PromptTitle,
    string? PromptEn,
    string Level,
    string? Topic,
    string Text,
    int WordCount,
    DateTimeOffset CreatedAt,
    WritingResultDto Result);

public record WritingSubmitResponse(WritingSubmissionDto Submission, WritingStatusDto Status);

public record WritingHistoryItemDto(Guid Id, string Title, string Level, int Score, int WordCount, DateTimeOffset CreatedAt, string Excerpt);

/// <param name="Hidden">Older paragraphs not listed on the free plan.</param>
public record WritingHistoryDto(IReadOnlyList<WritingHistoryItemDto> Items, int Total, int Hidden);

/// <param name="StatusCode">HTTP status: 400 bad request, 403 locked, 404 unknown, 429 allowance / day used up, 503 unavailable.</param>
/// <param name="Code">For the app: "limit" (learner's own allowance), "dayFull" (everyone's cap), "busy" (AI failed).</param>
public class WritingException(int statusCode, string message, string? code = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string? Code { get; } = code;
}

public interface IWritingService
{
    Task<WritingStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<WritingPromptDto>> GetPromptsAsync(CancellationToken ct = default);
    Task<WritingSubmitResponse> SubmitAsync(Guid userId, SubmitWritingRequest request, CancellationToken ct = default);
    Task<WritingHistoryDto> GetHistoryAsync(Guid userId, CancellationToken ct = default);
    Task<WritingSubmissionDto> GetAsync(Guid userId, Guid id, CancellationToken ct = default);
    Task DeleteAsync(Guid userId, Guid id, CancellationToken ct = default);
}

public record AdminWritingPromptDto(
    Guid Id,
    string Level,
    string TitleVi,
    string Icon,
    string PromptEn,
    string GuideVi,
    int MinWords,
    int MaxWords,
    IReadOnlyList<string> KeyPhrases,
    bool Published,
    int SortOrder,
    int Uses,
    DateTimeOffset UpdatedAt);

/// <param name="MinWords">0 uses <see cref="WritingRules.WordRange"/> for the level.</param>
public record SaveWritingPromptRequest(
    string Level,
    string TitleVi,
    string? Icon,
    string PromptEn,
    string? GuideVi,
    int MinWords,
    int MaxWords,
    List<string>? KeyPhrases,
    bool Published = true);

public record SaveWritingPromptBatchRequest(List<SaveWritingPromptRequest> Prompts);

public record WritingPromptDraftRequest(string Level, int Count, string? Topic, string? Notes, string? Provider = null);
/// <param name="Duplicate">A prompt with the same title already exists.</param>
public record WritingPromptDraftItemDto(SaveWritingPromptRequest Prompt, IReadOnlyList<string> Problems, bool Duplicate);
public record WritingPromptDraftDto(IReadOnlyList<WritingPromptDraftItemDto> Items, string Model);

/// <param name="Today">Gradings since UTC midnight (what <see cref="WritingConfig.DailyTotalCap"/> counts).</param>
/// <param name="Models">Gradings this month per AI model.</param>
public record WritingUsageDto(int Today, int Month, int Users, double AverageScore, IReadOnlyDictionary<string, int> Models);

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminWritingConfigDto(
    WritingConfig Value,
    WritingConfig Defaults,
    DateTimeOffset? UpdatedAt,
    WritingUsageDto Usage,
    IReadOnlyList<AiProviderDto> Providers);

/// <param name="Provider">One of <see cref="AiProviders"/>; null uses the configured order.</param>
/// <param name="Model">A model of that provider; null uses its writing models in order.</param>
public record WritingTryRequest(string Level, string Text, string? PromptEn, string? Provider, string? Model);

public record WritingTryDto(WritingResultDto Result, string Model, int Milliseconds);

public interface IAdminWritingService
{
    Task<IReadOnlyList<AdminWritingPromptDto>> GetPromptsAsync(CancellationToken ct = default);
    Task<AdminWritingPromptDto> CreateAsync(SaveWritingPromptRequest request, CancellationToken ct = default);
    Task<int> CreateBatchAsync(SaveWritingPromptBatchRequest request, CancellationToken ct = default);
    Task<AdminWritingPromptDto> UpdateAsync(Guid id, SaveWritingPromptRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<WritingPromptDraftDto> DraftAsync(WritingPromptDraftRequest request, CancellationToken ct = default);
    Task<AdminWritingConfigDto> GetConfigAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="WritingRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminWritingConfigDto> SaveConfigAsync(WritingConfig config, CancellationToken ct = default);
    Task<AdminWritingConfigDto> ResetConfigAsync(CancellationToken ct = default);
    /// <summary>Applies a snapshot from the history (recorded as a restore).</summary>
    Task RestoreConfigAsync(WritingConfig config, CancellationToken ct = default);
    /// <summary>Grades a paragraph without saving or counting it, to compare AI models.</summary>
    Task<WritingTryDto> TryAsync(WritingTryRequest request, CancellationToken ct = default);
}
