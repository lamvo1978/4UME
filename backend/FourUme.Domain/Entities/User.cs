namespace FourUme.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary><see cref="UserRoles.User"/> or <see cref="UserRoles.Admin"/>.</summary>
    public string Role { get; set; } = UserRoles.User;
    /// <summary>Set when an admin locks the account; locked users can't sign in.</summary>
    public DateTimeOffset? LockedAt { get; set; }
    /// <summary>Premium (more detailed pronunciation checks) until this moment; granted by an admin for now.</summary>
    public DateTimeOffset? PremiumUntil { get; set; }

    /// <summary>New words per day; also the flashcard batch size.</summary>
    public int DailyGoal { get; set; } = 10;
    public double SpeechRate { get; set; } = 0.9;
    public bool AutoSpeak { get; set; } = true;
    public bool ReminderEnabled { get; set; }
    /// <summary>Local time "HH:mm".</summary>
    public string ReminderTime { get; set; } = "20:00";
    public bool NotifyRescue { get; set; } = true;
    public bool NotifyWeekly { get; set; } = true;
    public bool NotifyNews { get; set; } = true;
    /// <summary>IANA zone reported by the app, e.g. "Asia/Ho_Chi_Minh"; used to time server-side notifications.</summary>
    public string? TimeZone { get; set; }

    /// <summary>CEFR level new vocabulary starts at (A1–B2); null until the learner takes the placement test or picks one.</summary>
    public string? VocabLevel { get; set; }
    /// <summary>What happens to words below <see cref="VocabLevel"/>: <c>skip</c> or <c>known</c>.</summary>
    public string EasyWordMode { get; set; } = "skip";
    public DateTimeOffset? PlacementTakenAt { get; set; }

    public int StreakFreezes { get; set; }
    public int BestStreak { get; set; }

    public ICollection<WordProgress> WordProgresses { get; set; } = new List<WordProgress>();
    public ICollection<GrammarAttempt> GrammarAttempts { get; set; } = new List<GrammarAttempt>();
    public ICollection<GrammarProgress> GrammarProgresses { get; set; } = new List<GrammarProgress>();
    public ICollection<StudyDay> StudyDays { get; set; } = new List<StudyDay>();
    public ICollection<DeviceToken> DeviceTokens { get; set; } = new List<DeviceToken>();
    public ICollection<NotificationLog> NotificationLogs { get; set; } = new List<NotificationLog>();
}
