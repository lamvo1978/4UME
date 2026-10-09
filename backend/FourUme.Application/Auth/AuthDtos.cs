namespace FourUme.Application.Auth;

public record RegisterRequest(string Email, string Password, string DisplayName);
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
    string? TimeZone);

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
    UserSettingsDto Settings);

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
    string? TimeZone = null);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record DeleteAccountRequest(string Password);

public static class UserSettingsRules
{
    public static readonly int[] DailyGoals = [5, 10, 15, 20];
    public const double MinSpeechRate = 0.5;
    public const double MaxSpeechRate = 1.2;
    public const int MinPasswordLength = 6;
    public const int MaxTimeZoneLength = 64;
}
