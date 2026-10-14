namespace FourUme.Application.Practice;

public static class PracticeRules
{
    public const int RoundSize = 10;
    public const int MaxRound = 30;
    public const int MaxEn = 200;
    public const int MaxVi = 300;
    public const int MaxTopic = 40;
    public const int MinWords = 3;
    public const int MaxDraftCount = 20;
    /// <summary>Activity log slug for sentence practice (ListeningLog.LessonSlug).</summary>
    public const string LogSlug = "practice";

    public static readonly string[] Levels = ["A1", "A2", "B1", "B2"];

    public static List<string> Validate(SavePracticeSentenceRequest s)
    {
        var errors = new List<string>();
        if (!Levels.Contains(s.Level)) errors.Add("Cấp độ phải là A1, A2, B1 hoặc B2.");
        if (string.IsNullOrWhiteSpace(s.En)) errors.Add("Thiếu câu tiếng Anh.");
        else
        {
            if (s.En.Length > MaxEn) errors.Add($"Câu tiếng Anh dài quá {MaxEn} ký tự.");
            if (s.En.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length < MinWords) errors.Add($"Câu cần ít nhất {MinWords} từ.");
            if (s.En.Any(c => c > 0x2FF && c is not ('\u2019' or '\u2018' or '\u201C' or '\u201D' or '\u2014' or '\u2013')))
                errors.Add("Câu tiếng Anh có ký tự lạ.");
        }
        if (string.IsNullOrWhiteSpace(s.Vi)) errors.Add("Thiếu nghĩa tiếng Việt.");
        else if (s.Vi.Length > MaxVi) errors.Add($"Nghĩa tiếng Việt dài quá {MaxVi} ký tự.");
        if ((s.Topic ?? "").Length > MaxTopic) errors.Add($"Chủ đề tối đa {MaxTopic} ký tự.");
        return errors;
    }

    /// <summary>Same sentence ignoring case, spacing and end punctuation.</summary>
    public static string Key(string en) =>
        new string(en.ToLowerInvariant().Where(c => char.IsLetterOrDigit(c) || c == ' ').ToArray()).Trim();
}

/// <summary>Who may practise: Premium always; free learners on the day after every <see cref="GiftEveryDays"/>-day streak, plus one try.</summary>
public class PracticeConfig
{
    public const string SettingKey = "practice";
    public const int MaxGiftEveryDays = 60;
    /// <summary>0 turns the streak gift off.</summary>
    public int GiftEveryDays { get; set; } = 7;
    public bool FreeTrial { get; set; } = true;

    public List<string> Validate()
    {
        var errors = new List<string>();
        if (GiftEveryDays is < 0 or > MaxGiftEveryDays) errors.Add($"Số ngày giữ chuỗi phải từ 0 đến {MaxGiftEveryDays}.");
        return errors;
    }
}

public static class PracticeAccessStates
{
    public const string Premium = "premium";
    /// <summary>Open until midnight as the streak gift.</summary>
    public const string Gift = "gift";
    /// <summary>The one free round is still available.</summary>
    public const string Trial = "trial";
    public const string Locked = "locked";
}

/// <param name="DaysToGift">Study days still needed for the next gift day; 0 = earned, it is tomorrow; null when the gift is off.</param>
public record PracticeAccessDto(string State, int GiftEveryDays, int? DaysToGift);

/// <param name="AudioUrl">Null while there is no recording; the app reads the sentence with the phone's voice.</param>
public record PracticeSentenceDto(Guid Id, string Level, string Topic, string En, string Vi, string? AudioUrl);
/// <param name="Count">Published sentences per level, so the app can grey out empty levels.</param>
public record PracticeLevelDto(string Level, int Count);
public record PracticeOverviewDto(IReadOnlyList<PracticeLevelDto> Levels, PracticeAccessDto Access);

public interface IPracticeService
{
    Task<PracticeOverviewDto> GetOverviewAsync(Guid userId, CancellationToken ct = default);
    /// <summary>A random round of published sentences at the level (fewer when the bank is small); null when the learner has no access.</summary>
    Task<IReadOnlyList<PracticeSentenceDto>?> GetRoundAsync(Guid userId, string level, int count, CancellationToken ct = default);
    /// <summary>One sentence checked; counts as study for the day like a dictation line.</summary>
    Task RecordAsync(Guid userId, CancellationToken ct = default);
}

public static class SentenceAudioStates
{
    public const string None = "none";
    public const string Ready = "ready";
    /// <summary>The English text changed after the audio was made.</summary>
    public const string Stale = "stale";
}

public record AdminPracticeSentenceDto(
    Guid Id,
    string Level,
    string Topic,
    string En,
    string Vi,
    bool Published,
    string? AudioUrl,
    string AudioState,
    DateTimeOffset UpdatedAt);

public record SavePracticeSentenceRequest(string Level, string? Topic, string En, string Vi, bool Published = true);
public record SavePracticeSentenceBatchRequest(List<SavePracticeSentenceRequest> Sentences);

public record PracticeDraftRequest(string Level, int Count, string? Topic, string? Notes, string? Provider = null);
/// <param name="Duplicate">Already in the bank (same words).</param>
public record PracticeDraftItemDto(SavePracticeSentenceRequest Sentence, IReadOnlyList<string> Problems, bool Duplicate);
public record PracticeDraftDto(IReadOnlyList<PracticeDraftItemDto> Items, string Model);

/// <param name="Missing">Published sentences without audio or with stale audio.</param>
/// <param name="MonthChars">Azure text-to-speech characters used this month (shared with listening audio).</param>
public record SentenceAudioStatusDto(bool Configured, bool Running, int Done, int Total, string? Error, int Missing, int MonthChars, int MonthCharLimit);

/// <summary>One sentence in an export file; without <paramref name="Id"/> the import creates it, with one it updates that sentence.</summary>
public record PracticeSentenceFileItem(Guid? Id, string Level, string? Topic, string En, string Vi, bool Published = true);
/// <param name="Commit">False only previews what would change.</param>
public record ImportPracticeSentencesRequest(List<PracticeSentenceFileItem> Sentences, bool Commit);
/// <param name="Line">1-based position in the file.</param>
public record ImportPracticeSentenceRow(int Line, Guid? Id, string Level, string En, string Status, IReadOnlyList<string> Problems);
public record ImportPracticeSentencesResult(int Created, int Updated, int Unchanged, int Errors, bool Committed, IReadOnlyList<ImportPracticeSentenceRow> Rows);

public interface IAdminPracticeService
{
    Task<IReadOnlyList<AdminPracticeSentenceDto>> GetAllAsync(CancellationToken ct = default);
    Task<AdminPracticeSentenceDto> CreateAsync(SavePracticeSentenceRequest request, CancellationToken ct = default);
    Task<int> CreateBatchAsync(SavePracticeSentenceBatchRequest request, CancellationToken ct = default);
    Task<AdminPracticeSentenceDto> UpdateAsync(Guid id, SavePracticeSentenceRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<PracticeDraftDto> DraftAsync(PracticeDraftRequest request, CancellationToken ct = default);
    Task<SentenceAudioStatusDto> GetAudioStatusAsync(CancellationToken ct = default);
    /// <summary>Starts making audio for every published sentence that has none or stale audio.</summary>
    Task<SentenceAudioStatusDto> StartAudioAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PracticeSentenceFileItem>> ExportAsync(CancellationToken ct = default);
    Task<ImportPracticeSentencesResult> ImportAsync(ImportPracticeSentencesRequest request, CancellationToken ct = default);
    Task<PracticeConfig> GetConfigAsync(CancellationToken ct = default);
    Task<PracticeConfig> SaveConfigAsync(PracticeConfig config, CancellationToken ct = default);
}
