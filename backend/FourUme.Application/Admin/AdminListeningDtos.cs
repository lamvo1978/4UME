using FourUme.Application.Listening;

namespace FourUme.Application.Admin;

public static class ListeningAudioStates
{
    /// <summary>Never generated.</summary>
    public const string None = "none";
    public const string Ready = "ready";
    /// <summary>Generated, but the script or voices changed since.</summary>
    public const string Stale = "stale";
    public const string Running = "running";
    public const string Failed = "failed";
}

public record AdminListeningSummaryDto(
    string Slug,
    string TitleEn,
    string TitleVi,
    string Kind,
    string Level,
    string? Topic,
    int SortOrder,
    bool Published,
    int LineCount,
    int Chars,
    int? DurationMs,
    string AudioState,
    int Listeners,
    int Completions,
    int Likes,
    int Version,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? EditedAt);

/// <param name="Timings">[startMs, endMs] per line, only while the audio is current.</param>
/// <param name="Done">Lines synthesized so far while running.</param>
public record AdminListeningAudioDto(
    string State,
    string? Url,
    int? DurationMs,
    IReadOnlyList<int[]>? Timings,
    int Done,
    int Total,
    string? Error);

public record AdminListeningDetailDto(
    ListeningLessonDocument Lesson,
    AdminListeningAudioDto Audio,
    int Chars,
    int Listeners,
    int Completions,
    int Likes,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? EditedAt,
    IReadOnlyList<string> Problems);

public record ListeningValidationDto(IReadOnlyList<string> Problems);

public record ImportListeningRequest(IReadOnlyList<ListeningLessonDocument> Lessons, bool Commit);

public record ImportListeningRowResult(string Slug, string TitleEn, string Status, int? CurrentVersion, IReadOnlyList<string> Problems);

public record ImportListeningResult(int Created, int Updated, int Unchanged, int Errors, bool Committed, IReadOnlyList<ImportListeningRowResult> Rows);

/// <param name="Configured">False until Speech:Key / Speech:Region are set on the server.</param>
/// <param name="CharsUsed">Characters sent to the speech service this calendar month (UTC).</param>
public record SpeechStatusDto(
    bool Configured,
    string? Region,
    IReadOnlyList<ListeningVoice> Voices,
    string Month,
    int CharsUsed,
    int MonthlyCharLimit);

public record VoicePreviewRequest(string Voice, string? Text, string? Level);

public interface IAdminListeningService
{
    Task<IReadOnlyList<AdminListeningSummaryDto>> GetLessonsAsync(CancellationToken ct = default);
    Task<AdminListeningDetailDto?> GetLessonAsync(string slug, CancellationToken ct = default);
    Task<AdminListeningDetailDto> CreateLessonAsync(ListeningLessonDocument doc, CancellationToken ct = default);
    Task<AdminListeningDetailDto> UpdateLessonAsync(string slug, ListeningLessonDocument doc, CancellationToken ct = default);
    Task DeleteLessonAsync(string slug, CancellationToken ct = default);
    /// <summary>Applies a snapshot from the history (recorded as a restore).</summary>
    Task RestoreLessonAsync(ListeningLessonDocument doc, CancellationToken ct = default);
    Task ReorderLessonsAsync(ReorderRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ListeningLessonDocument>> ExportLessonsAsync(CancellationToken ct = default);
    Task<ImportListeningResult> ImportLessonsAsync(ImportListeningRequest request, CancellationToken ct = default);

    /// <summary>Starts generating the audio in the background; poll <see cref="GetLessonAsync"/> for progress.</summary>
    Task<AdminListeningAudioDto> GenerateAudioAsync(string slug, CancellationToken ct = default);
    Task<SpeechStatusDto> GetSpeechStatusAsync(CancellationToken ct = default);
    /// <summary>A short MP3 sample of a voice.</summary>
    Task<byte[]> PreviewVoiceAsync(VoicePreviewRequest request, CancellationToken ct = default);
}
