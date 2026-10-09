namespace FourUme.Application.Listening;

/// <summary>System-wide listening options (admin "Cài đặt"), stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record ListeningConfig
{
    public const string SettingKey = "listening";

    /// <summary>Finishing a piece marks the day as studied (keeps the streak).</summary>
    public bool CountsTowardStreak { get; init; }
}

public record ListeningProgressDto(int PositionMs, bool Completed, int TimesCompleted, bool Liked);

/// <param name="HasAudio">False while the audio is missing or out of date; the app then reads the script with the device voice.</param>
public record ListeningSummaryDto(
    string Slug,
    string TitleEn,
    string TitleVi,
    string Kind,
    string Level,
    string? Topic,
    string SummaryVi,
    int LineCount,
    bool HasAudio,
    int? DurationMs,
    ListeningProgressDto Progress);

public record ListeningSpeakerDto(string Key, string Name);

/// <param name="StartMs">Null when there is no current audio.</param>
public record ListeningLineDto(string Speaker, string En, string Vi, int? StartMs, int? EndMs);

public record ListeningDetailDto(
    string Slug,
    string TitleEn,
    string TitleVi,
    string Kind,
    string Level,
    string? Topic,
    string SummaryVi,
    string? AudioUrl,
    int? DurationMs,
    IReadOnlyList<ListeningSpeakerDto> Speakers,
    IReadOnlyList<ListeningLineDto> Lines,
    ListeningProgressDto Progress);

/// <param name="Completed">True once the learner reached the end; never turns a finished piece back to unfinished.</param>
public record UpdateListeningProgressRequest(int? PositionMs, bool? Completed, bool? Liked);

public interface IListeningService
{
    Task<IReadOnlyList<ListeningSummaryDto>> GetLessonsAsync(Guid userId, CancellationToken ct = default);
    Task<ListeningDetailDto?> GetLessonAsync(Guid userId, string slug, CancellationToken ct = default);
    /// <summary>Null when the lesson does not exist or is hidden.</summary>
    Task<ListeningProgressDto?> UpdateProgressAsync(Guid userId, string slug, UpdateListeningProgressRequest request, CancellationToken ct = default);
    Task<ListeningConfig> GetConfigAsync(CancellationToken ct = default);
}
