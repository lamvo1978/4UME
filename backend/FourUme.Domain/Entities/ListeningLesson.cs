namespace FourUme.Domain.Entities;

/// <summary>
/// A listening piece (dialogue, story or news-style text) with its script. Speakers and lines are JSON
/// documents (see ListeningLessonDocument); the audio is generated from them in the admin.
/// </summary>
public class ListeningLesson
{
    public string Slug { get; set; } = string.Empty;
    public int Version { get; set; }
    public string TitleEn { get; set; } = string.Empty;
    public string TitleVi { get; set; } = string.Empty;
    public string SummaryVi { get; set; } = string.Empty;
    /// <summary><see cref="ListeningKinds"/>.</summary>
    public string Kind { get; set; } = ListeningKinds.Dialogue;
    public string Level { get; set; } = string.Empty;
    public string? Topic { get; set; }
    public int SortOrder { get; set; }
    public bool Published { get; set; } = true;
    public string SpeakersJson { get; set; } = "[]";
    public string LinesJson { get; set; } = "[]";

    /// <summary>"/media/listening/…mp3"; a new file name on every generation because /media is cached as immutable.</summary>
    public string? AudioUrl { get; set; }
    /// <summary>Hash of what the audio was generated from; differs from the current one when the script changed since.</summary>
    public string? AudioHash { get; set; }
    public int? DurationMs { get; set; }
    /// <summary>JSON <c>[[startMs, endMs], …]</c>, one pair per line, valid while <see cref="AudioHash"/> matches.</summary>
    public string? TimingsJson { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>Set when edited in the admin; the seeder then leaves the lesson alone.</summary>
    public DateTimeOffset? EditedAt { get; set; }
}

public static class ListeningKinds
{
    public const string Dialogue = "dialogue";
    public const string Story = "story";
    public const string News = "news";
    public static readonly string[] All = [Dialogue, Story, News];
}
