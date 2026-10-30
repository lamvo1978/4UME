using FourUme.Application.Admin;
using FourUme.Application.Listening;

namespace FourUme.Application.Conversations;

/// <summary>System-wide options for "Đàm thoại với AI", stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record ConversationConfig
{
    public const string SettingKey = "conversation";

    public bool Enabled { get; init; } = true;
    /// <summary>Stored for older admin JSON only. Quota and the Premium screen use the session fields below.</summary>
    public int FreeDailyTurns { get; init; } = 10;
    public int PremiumDailyTurns { get; init; } = 100;
    /// <summary>One-time free trial session (turns).</summary>
    public int FreeFirstSessionTurns { get; init; } = 12;
    /// <summary>Streak gift interval; 0 disables.</summary>
    public int StreakGiftEveryDays { get; init; } = 7;
    public int StreakGiftSessionTurns { get; init; } = 12;
    public int PremiumSessionsPerDay { get; init; } = 1;
    public int PremiumTurnsPerSession { get; init; } = 20;
    public int AddonSessionsPerDay { get; init; } = 3;
    public int AddonTurnsPerSession { get; init; } = 20;
    public int AddonDailyTurnCap { get; init; } = 60;
    /// <summary>Learner messages per conversation; afterwards the app offers the summary.</summary>
    public int MaxTurnsPerSession { get; init; } = 20;
    /// <summary>Premium replies are read with an Azure voice instead of the phone's; off by default.</summary>
    public bool PremiumAzureVoice { get; init; }
    public string AzureVoice { get; init; } = "en-US-JennyNeural";
    /// <summary>Characters per calendar month (UTC) on the free Azure resource; F0 has 500,000 shared with listening and word audio.</summary>
    public int FreeMonthlyChars { get; init; } = 100_000;
    /// <summary>Characters per month on the paid resource (S0) once the free share is used; 0 never uses S0.</summary>
    public int PaidMonthlyChars { get; init; } = 200_000;
}

public static class ConversationSessionKinds
{
    public const string First = "first";
    public const string StreakGift = "streak_gift";
    public const string Premium = "premium";
    public const string Addon = "addon";
}

public static class ConversationBlockedReasons
{
    public const string NeedPremium = "need_premium";
    public const string NoSessionsLeft = "no_sessions_left";
}

public static class ConversationRules
{
    public static readonly string[] Levels = ["A1", "A2", "B1", "B2"];
    public const int MaxLimit = 1000;
    public const int MaxSessionTurns = 100;
    public const int MaxMonthlyChars = 10_000_000;
    /// <summary>One learner message; a spoken sentence is far shorter.</summary>
    public const int MaxLearnerText = 300;
    /// <summary>Messages sent to the AI with each turn, to keep requests small.</summary>
    public const int HistoryTurns = 12;
    public const int MaxTitle = 80;
    public const int MaxSituation = 500;
    public const int MaxAiRole = 100;
    public const int MaxGoal = 200;
    public const int MaxOpening = 250;
    public const int MaxPhrases = 8;
    public const int MaxPhrase = 60;
    public const int MaxIcon = 40;
    public const int MaxDraftCount = 10;
    /// <summary>Azure neural voices, about USD 15 per million characters on S0.</summary>
    public const double PaidUsdPerMillionChars = 15;
    public const string DefaultIcon = "chatbubbles-outline";

    /// <summary>Premium turns per day for copy ({ai}): sessions × turns per session.</summary>
    public static int PremiumTurnsPerDayForDisplay(ConversationConfig c) =>
        c.PremiumSessionsPerDay * c.PremiumTurnsPerSession;

    /// <summary>
    /// Free-plan figure for copy ({aiFree}): turns in one streak-gift session, or the one-time trial when gifts are off.
    /// Free learners do not get this many turns every calendar day.
    /// </summary>
    public static int FreeTurnsForDisplay(ConversationConfig c) =>
        c.StreakGiftEveryDays > 0 ? c.StreakGiftSessionTurns : c.FreeFirstSessionTurns;

    public static IReadOnlyList<string> Validate(ConversationConfig c)
    {
        var problems = new List<string>();
        if (c.FreeDailyTurns is < 0 or > MaxLimit) problems.Add($"Lượt miễn phí mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.PremiumDailyTurns is < 0 or > MaxLimit) problems.Add($"Lượt Premium mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.FreeFirstSessionTurns is < 0 or > MaxSessionTurns) problems.Add($"Lượt buổi thử phải từ 0 đến {MaxSessionTurns}.");
        if (c.StreakGiftEveryDays is < 0 or > 365) problems.Add("Chu kỳ quà chuỗi phải từ 0 đến 365 ngày.");
        if (c.StreakGiftSessionTurns is < 0 or > MaxSessionTurns) problems.Add($"Lượt buổi quà chuỗi phải từ 0 đến {MaxSessionTurns}.");
        if (c.PremiumSessionsPerDay is < 0 or > 50) problems.Add("Số buổi Premium mỗi ngày phải từ 0 đến 50.");
        if (c.PremiumTurnsPerSession is < 0 or > MaxSessionTurns) problems.Add($"Lượt mỗi buổi Premium phải từ 0 đến {MaxSessionTurns}.");
        if (c.AddonSessionsPerDay is < 0 or > 50) problems.Add("Số buổi mở rộng mỗi ngày phải từ 0 đến 50.");
        if (c.AddonTurnsPerSession is < 0 or > MaxSessionTurns) problems.Add($"Lượt mỗi buổi mở rộng phải từ 0 đến {MaxSessionTurns}.");
        if (c.AddonDailyTurnCap is < 0 or > MaxLimit) problems.Add($"Trần lượt mở rộng mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.MaxTurnsPerSession is < 2 or > MaxSessionTurns) problems.Add($"Lượt mỗi buổi phải từ 2 đến {MaxSessionTurns}.");
        if (c.FreeMonthlyChars is < 0 or > MaxMonthlyChars) problems.Add("Ký tự F0 mỗi tháng không hợp lệ.");
        if (c.PaidMonthlyChars is < 0 or > MaxMonthlyChars) problems.Add("Ký tự S0 mỗi tháng không hợp lệ.");
        if (!ListeningRules.Voices.Any(v => v.Name == c.AzureVoice)) problems.Add("Giọng Azure không hợp lệ.");
        return problems;
    }

    public static List<string> Validate(SaveConversationScenarioRequest s)
    {
        var errors = new List<string>();
        if (!Levels.Contains(s.Level)) errors.Add("Cấp độ phải là A1, A2, B1 hoặc B2.");
        Required(errors, s.TitleVi, MaxTitle, "Tiêu đề");
        Required(errors, s.Situation, MaxSituation, "Bối cảnh");
        Required(errors, s.AiRole, MaxAiRole, "Vai của AI");
        Required(errors, s.GoalVi, MaxGoal, "Mục tiêu");
        Required(errors, s.Opening, MaxOpening, "Câu mở đầu");
        if ((s.Icon ?? "").Length > MaxIcon) errors.Add("Tên biểu tượng quá dài.");
        var phrases = s.KeyPhrases ?? [];
        if (phrases.Count > MaxPhrases) errors.Add($"Tối đa {MaxPhrases} cụm từ gợi ý.");
        if (phrases.Any(p => p.Length > MaxPhrase)) errors.Add($"Mỗi cụm từ gợi ý tối đa {MaxPhrase} ký tự.");
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

public static class ConversationVoices
{
    /// <summary>The app reads the reply with the phone's voice.</summary>
    public const string Device = "device";
    /// <summary>Replies come with an Azure recording (<see cref="ConversationTurnDto.AudioUrl"/>); the phone's voice covers any gap.</summary>
    public const string Azure = "azure";
}

/// <param name="Available">False when the AI isn't configured on the server.</param>
/// <param name="DailyLimit">Messages for today on the learner's plan.</param>
/// <param name="Remaining">Messages left today; 0 also when the feature is off.</param>
/// <param name="Voice">See <see cref="ConversationVoices"/>.</param>
public record ConversationStatusDto(
    bool Enabled,
    bool Available,
    bool Premium,
    int DailyLimit,
    int UsedToday,
    int Remaining,
    int FreeDailyLimit,
    int PremiumDailyLimit,
    int MaxTurnsPerSession,
    string Voice,
    int SessionsAllowedToday = 0,
    int SessionsUsedToday = 0,
    int TurnsPerSession = 0,
    string? NextSessionKind = null,
    string? BlockedReason = null,
    bool ConversationAddon = false,
    DateTimeOffset? ConversationAddonUntil = null,
    /// <summary>From admin config — for Premium screen copy (not user-specific).</summary>
    int PremiumSessionsPerDay = 1,
    int PremiumTurnsPerSession = 20,
    int AddonSessionsPerDay = 3,
    int AddonTurnsPerSession = 20,
    int AddonDailyTurnCap = 60);

public record ConversationScenarioDto(Guid Id, string Level, string TitleVi, string Icon, string GoalVi, string AiRole, IReadOnlyList<string> KeyPhrases);

public record ConversationCorrectionDto(string Original, string Corrected, string ExplainVi);

/// <param name="AudioUrl">Azure recording of an AI turn; null means the app reads it with the phone's voice.</param>
public record ConversationTurnDto(
    Guid Id,
    bool FromLearner,
    string Text,
    ConversationCorrectionDto? Correction,
    string? HintVi,
    IReadOnlyList<string> Suggestions,
    string? AudioUrl);

/// <param name="ScenarioId">Null starts free talk.</param>
public record StartConversationRequest(Guid? ScenarioId, string? Level);

public record ConversationStartDto(Guid Id, string Level, ConversationScenarioDto? Scenario, ConversationTurnDto Opening, ConversationStatusDto Status);

public record SendConversationTurnRequest(string Text);

/// <param name="GoalDone">Role-play: the learner reached the scenario's goal.</param>
/// <param name="SessionFull">No more messages fit in this conversation; the app offers the summary.</param>
public record ConversationReplyDto(ConversationTurnDto Learner, ConversationTurnDto Reply, bool GoalDone, bool SessionFull, ConversationStatusDto Status);

public record ConversationPhraseDto(string En, string Vi);

public record ConversationSummaryDto(int Score, string FeedbackVi, IReadOnlyList<ConversationCorrectionDto> Mistakes, IReadOnlyList<ConversationPhraseDto> Phrases, int LearnerTurns);

/// <param name="StatusCode">HTTP status for the API: 400 bad request, 404 unknown conversation, 429 allowance used up, 503 unavailable.</param>
public class ConversationException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public interface IConversationService
{
    Task<ConversationStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<ConversationScenarioDto>> GetScenariosAsync(CancellationToken ct = default);
    Task<ConversationStartDto> StartAsync(Guid userId, StartConversationRequest request, CancellationToken ct = default);
    Task<ConversationReplyDto> SendAsync(Guid userId, Guid conversationId, string text, CancellationToken ct = default);
    /// <summary>Summarises the talk once; later calls return the stored summary.</summary>
    Task<ConversationSummaryDto> EndAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
}

public record AdminConversationScenarioDto(
    Guid Id,
    string Level,
    string TitleVi,
    string Icon,
    string Situation,
    string AiRole,
    string GoalVi,
    string Opening,
    IReadOnlyList<string> KeyPhrases,
    bool Published,
    int SortOrder,
    int Uses,
    DateTimeOffset UpdatedAt);

public record SaveConversationScenarioRequest(
    string Level,
    string TitleVi,
    string? Icon,
    string Situation,
    string AiRole,
    string GoalVi,
    string Opening,
    List<string>? KeyPhrases,
    bool Published = true);

public record SaveConversationScenarioBatchRequest(List<SaveConversationScenarioRequest> Scenarios);

public record ConversationScenarioDraftRequest(string Level, int Count, string? Topic, string? Notes, string? Provider = null);
/// <param name="Duplicate">A scenario with the same title already exists.</param>
public record ConversationScenarioDraftItemDto(SaveConversationScenarioRequest Scenario, IReadOnlyList<string> Problems, bool Duplicate);
public record ConversationScenarioDraftDto(IReadOnlyList<ConversationScenarioDraftItemDto> Items, string Model);

/// <param name="FreeChars">Azure characters on the free resource this month for conversation.</param>
/// <param name="SpeechMonthChars">All text-to-speech characters on the free resource this month (listening, sentences, words, conversation).</param>
public record ConversationUsageDto(
    int Sessions,
    int Users,
    int LearnerTurns,
    int FreeChars,
    int PaidChars,
    double PaidUsd,
    int SpeechMonthChars,
    int SpeechMonthLimit);

/// <param name="UpdatedAt">null while the defaults are in use.</param>
public record AdminConversationConfigDto(
    ConversationConfig Value,
    ConversationConfig Defaults,
    DateTimeOffset? UpdatedAt,
    ConversationUsageDto Usage,
    IReadOnlyList<AiProviderDto> Providers,
    bool AzureConfigured,
    bool PaidConfigured,
    IReadOnlyList<ListeningVoice> Voices);

public interface IAdminConversationService
{
    Task<IReadOnlyList<AdminConversationScenarioDto>> GetScenariosAsync(CancellationToken ct = default);
    Task<AdminConversationScenarioDto> CreateAsync(SaveConversationScenarioRequest request, CancellationToken ct = default);
    Task<int> CreateBatchAsync(SaveConversationScenarioBatchRequest request, CancellationToken ct = default);
    Task<AdminConversationScenarioDto> UpdateAsync(Guid id, SaveConversationScenarioRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<ConversationScenarioDraftDto> DraftAsync(ConversationScenarioDraftRequest request, CancellationToken ct = default);
    Task<AdminConversationConfigDto> GetConfigAsync(CancellationToken ct = default);
    /// <summary>Validates with <see cref="ConversationRules"/>; throws InvalidOperationException listing the problems.</summary>
    Task<AdminConversationConfigDto> SaveConfigAsync(ConversationConfig config, CancellationToken ct = default);
    Task<AdminConversationConfigDto> ResetConfigAsync(CancellationToken ct = default);
    /// <summary>Applies a snapshot from the history (recorded as a restore).</summary>
    Task RestoreConfigAsync(ConversationConfig config, CancellationToken ct = default);
}
