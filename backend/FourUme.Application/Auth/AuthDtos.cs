namespace FourUme.Application.Auth;

/// <summary><paramref name="Code"/> is the one mailed by <c>/api/auth/register/code</c>.</summary>
public record RegisterRequest(string Email, string Password, string DisplayName, string? Code = null);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string AccessToken, Guid UserId, string Email, string DisplayName);

public record UserSettingsDto(
    int DailyGoal,
    double SpeechRate,
    bool AutoSpeak,
    bool ReminderEnabled,
    string ReminderTime,
    bool NotifyRescue,
    bool NotifyWeekly,
    bool NotifyNews,
    string? TimeZone,
    string? VocabLevel,
    string EasyWordMode,
    DateTimeOffset? PlacementTakenAt,
    string? Avatar = null);

public record MeResponse(
    Guid UserId,
    string Email,
    string DisplayName,
    int KnownWords,
    int HardWords,
    int GrammarLessonsCompleted,
    int GrammarLessonsTotal,
    int Streak,
    bool StudiedToday,
    int TodayNewWords,
    int StreakFreezes,
    int? NextMilestone,
    DateOnly? LastStudyDate,
    UserSettingsDto Settings,
    /// <summary>Premium is active now (no ads), from any source.</summary>
    bool Premium = false,
    /// <summary>Hidden features unlocked by a partner code, e.g. "ielts".</summary>
    IReadOnlyList<string>? Features = null,
    /// <summary>Set while the learner is a partner's student.</summary>
    string? PartnerName = null,
    /// <summary>End of partner access; null runs until the code is revoked.</summary>
    DateTimeOffset? PartnerUntil = null,
    /// <summary>Show the Home banner ad: switched on in admin and the learner isn't Premium.</summary>
    bool AdsBanner = false,
    DateTimeOffset? PremiumUntil = null,
    bool ConversationAddon = false,
    DateTimeOffset? ConversationAddonUntil = null);

/// <summary>Every field is optional; only the ones sent are changed.</summary>
public record UpdateSettingsRequest(
    string? DisplayName,
    int? DailyGoal,
    double? SpeechRate,
    bool? AutoSpeak,
    bool? ReminderEnabled,
    string? ReminderTime,
    bool? NotifyRescue = null,
    bool? NotifyWeekly = null,
    bool? NotifyNews = null,
    string? TimeZone = null,
    /// <summary>A built-in avatar key; "" goes back to the name's initial.</summary>
    string? Avatar = null);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record DeleteAccountRequest(string Password);

public record SendCodeRequest(string Email);
public record SendCodeResponse(int ResendAfterSeconds, int ExpiresInMinutes);
public record ResetPasswordRequest(string Email, string Code, string NewPassword);

public static class EmailCodeRules
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ResendAfter = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan SendWindow = TimeSpan.FromHours(1);
    public const int MaxSendsPerWindow = 5;
    public const int MaxAttempts = 5;
}

public static class UserSettingsRules
{
    public static readonly int[] DailyGoals = [5, 10, 15, 20];
    public const double MinSpeechRate = 0.5;
    public const double MaxSpeechRate = 1.2;
    public const int MinPasswordLength = 6;
    public const int MaxTimeZoneLength = 64;
    /// <summary>Avatar pictures ship with the app, so the server only checks the key's shape; an unknown key shows the initial.</summary>
    public const int MaxAvatarLength = 32;
}
