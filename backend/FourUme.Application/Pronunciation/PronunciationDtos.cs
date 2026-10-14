namespace FourUme.Application.Pronunciation;

/// <summary>System-wide pronunciation-check options (admin "Cài đặt"), stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record PronunciationConfig
{
    public const string SettingKey = "pronunciation";

    public bool Enabled { get; init; } = true;
    /// <summary>Detailed checks (Azure) per day without Premium; every check counts, retries included. Afterwards the app falls back to comparing by ear.</summary>
    public int FreeDailyLimit { get; init; } = 3;
    public int PremiumDailyLimit { get; init; } = 50;
    /// <summary>Free learners who ran out may watch a rewarded ad for one more check. Off until the app ships with ads.</summary>
    public bool AdRewardsEnabled { get; init; }
    /// <summary>Rewarded ads that count per learner per day.</summary>
    public int AdRewardsPerDay { get; init; } = 10;
    /// <summary>Audio minutes sent to the free Azure resource per calendar month (UTC) across all users; F0 covers 300.</summary>
    public int MonthlyMinutesCap { get; init; } = 300;
    /// <summary>
    /// Audio minutes per month on the paid resource (S0), the spending ceiling. Checks from the free daily allowance
    /// stop at <see cref="PronunciationRules.FreePlanPaidShare"/> of it so Premium and ad-earned checks keep the rest.
    /// </summary>
    public int PaidMonthlyMinutesCap { get; init; } = 600;
}

public static class PronunciationRules
{
    public const int MaxLimit = 1000;
    public const int MaxAdRewardsPerDay = 50;
    public const int MaxAudioBytes = 2 * 1024 * 1024;
    /// <summary>Longer recordings are cut; one word needs far less.</summary>
    public const int MaxAudioSeconds = 6;
    public const double FreePlanPaidShare = 0.8;

    public static IReadOnlyList<string> Validate(PronunciationConfig c)
    {
        var problems = new List<string>();
        if (c.FreeDailyLimit is < 0 or > MaxLimit) problems.Add($"Lượt miễn phí mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.PremiumDailyLimit is < 0 or > MaxLimit) problems.Add($"Lượt Premium mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.AdRewardsPerDay is < 0 or > MaxAdRewardsPerDay) problems.Add($"Số quảng cáo mỗi ngày phải từ 0 đến {MaxAdRewardsPerDay}.");
        if (c.MonthlyMinutesCap is < 0 or > 100_000) problems.Add("Giới hạn phút mỗi tháng không hợp lệ.");
        if (c.PaidMonthlyMinutesCap is < 0 or > 100_000) problems.Add("Giới hạn phút trả phí mỗi tháng không hợp lệ.");
        return problems;
    }
}

/// <param name="DailyLimit">Checks for today: the plan's allowance plus checks earned from ads today.</param>
/// <param name="UsedToday">Checks run today; every check counts, retries of a word included.</param>
/// <param name="Remaining">Checks left today; 0 also when the feature is off or the monthly budget is used up.</param>
/// <param name="ServiceAvailable">False when Azure isn't configured or this month's audio budget is spent.</param>
/// <param name="PremiumDailyLimit">Shown to free users so they can see what Premium adds.</param>
/// <param name="FreeDailyLimit">Lets the plan comparison show both columns whichever plan the user is on.</param>
/// <param name="AdsWatchedToday">Rewarded ads already counted today.</param>
/// <param name="AdsDailyLimit">How many ads this user may watch per day; 0 (no ads offered) for Premium, when ads are off or the scorer is paused.</param>
/// <param name="AdsLeftToday">Ads that can still earn a check today.</param>
/// <param name="PartnerName">Premium through a partner centre while set.</param>
/// <param name="PartnerUntil">End of partner access; null runs until the centre's code is revoked.</param>
/// <param name="PausedPremiumDays">Own Premium days on hold while studying with the centre.</param>
public record PronunciationStatusDto(
    bool Enabled,
    bool Premium,
    DateTimeOffset? PremiumUntil,
    int DailyLimit,
    int UsedToday,
    int Remaining,
    bool ServiceAvailable,
    int PremiumDailyLimit,
    int FreeDailyLimit,
    int AdsWatchedToday,
    int AdsDailyLimit,
    int AdsLeftToday,
    string? PartnerName = null,
    DateTimeOffset? PartnerUntil = null,
    int PausedPremiumDays = 0);

public record PhonemeScoreDto(string Phoneme, int Score);

/// <param name="ErrorType">Azure's verdict for the word: None, Mispronunciation, Omission, Insertion.</param>
public record WordScoreDto(string Word, int Score, string ErrorType, IReadOnlyList<PhonemeScoreDto> Phonemes);

/// <param name="Heard">What the recogniser understood (biased toward the expected word).</param>
public record PronunciationResultDto(
    int Score,
    int Accuracy,
    int Fluency,
    int Completeness,
    string Heard,
    IReadOnlyList<WordScoreDto> Words,
    PronunciationStatusDto Status);

/// <param name="Minutes">Audio minutes on the free resource.</param>
/// <param name="AdRewards">Rewarded ads counted this month (each gave one extra check).</param>
/// <param name="PaidMinutes">Audio minutes billed on the paid resource.</param>
/// <param name="FreeSpent">The free resource reported its monthly quota gone before the minute cap was reached.</param>
public record PronunciationUsageDto(int Attempts, int Users, double Minutes, int AdRewards, double PaidMinutes = 0, bool FreeSpent = false);

/// <summary>Outcome of one rewarded-ad callback.</summary>
public enum AdRewardOutcome
{
    Granted,
    /// <summary>The same transaction arrived again; nothing changed.</summary>
    Duplicate,
    /// <summary>Daily cap reached, ads switched off, Premium, or unknown user: verified but not counted.</summary>
    NotCounted,
}

/// <param name="StatusCode">HTTP status for the API: 400 bad audio, 429 quota used up, 503 service unavailable.</param>
public class PronunciationException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public interface IPronunciationService
{
    Task<PronunciationConfig> GetConfigAsync(CancellationToken ct = default);
    Task<PronunciationStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
    Task<PronunciationResultDto> AssessAsync(Guid userId, string wordId, Stream audio, CancellationToken ct = default);
    Task<PronunciationUsageDto> GetMonthUsageAsync(CancellationToken ct = default);
    /// <summary>Adds one check to <paramref name="localDate"/> for a verified ad view.</summary>
    Task<AdRewardOutcome> GrantAdRewardAsync(Guid userId, DateOnly localDate, string transactionId, string source, CancellationToken ct = default);
}
