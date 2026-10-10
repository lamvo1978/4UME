namespace FourUme.Application.Pronunciation;

/// <summary>System-wide pronunciation-check options (admin "Cài đặt"), stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record PronunciationConfig
{
    public const string SettingKey = "pronunciation";

    public bool Enabled { get; init; } = true;
    /// <summary>Detailed (Azure) checks per day without Premium; afterwards the app falls back to a basic check.</summary>
    public int FreeDailyLimit { get; init; } = 3;
    public int PremiumDailyLimit { get; init; } = 50;
    /// <summary>Audio minutes sent to Azure per calendar month (UTC) across all users; the free tier (F0) covers 300.</summary>
    public int MonthlyMinutesCap { get; init; } = 300;
}

public static class PronunciationRules
{
    public const int MaxLimit = 1000;
    public const int MaxAudioBytes = 2 * 1024 * 1024;
    /// <summary>Longer recordings are cut; one word needs far less.</summary>
    public const int MaxAudioSeconds = 6;

    public static IReadOnlyList<string> Validate(PronunciationConfig c)
    {
        var problems = new List<string>();
        if (c.FreeDailyLimit is < 0 or > MaxLimit) problems.Add($"Lượt miễn phí mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.PremiumDailyLimit is < 0 or > MaxLimit) problems.Add($"Lượt Premium mỗi ngày phải từ 0 đến {MaxLimit}.");
        if (c.MonthlyMinutesCap is < 0 or > 100_000) problems.Add("Giới hạn phút mỗi tháng không hợp lệ.");
        return problems;
    }
}

/// <param name="Remaining">Detailed checks left today; 0 also when the feature is off or the monthly budget is used up.</param>
/// <param name="ServiceAvailable">False when Azure isn't configured or this month's audio budget is spent.</param>
/// <param name="PremiumDailyLimit">Shown to free users so they can see what Premium adds.</param>
/// <param name="FreeDailyLimit">Lets the plan comparison show both columns whichever plan the user is on.</param>
public record PronunciationStatusDto(
    bool Enabled,
    bool Premium,
    DateTimeOffset? PremiumUntil,
    int DailyLimit,
    int UsedToday,
    int Remaining,
    bool ServiceAvailable,
    int PremiumDailyLimit,
    int FreeDailyLimit);

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

public record PronunciationUsageDto(int Attempts, int Users, double Minutes);

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
}
