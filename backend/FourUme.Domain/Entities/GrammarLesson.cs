namespace FourUme.Domain.Entities;

/// <summary>
/// A grammar lesson. Theory and exercises are stored as JSON documents following
/// docs/grammar-lesson-schema.md so the admin can edit them without migrations.
/// </summary>
public class GrammarLesson
{
    public string Slug { get; set; } = string.Empty;
    public int Version { get; set; }
    public string TitleVi { get; set; } = string.Empty;
    public string? TitleEn { get; set; }
    public string Level { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string SummaryVi { get; set; } = string.Empty;
    public int QuizSize { get; set; } = 8;
    public bool Published { get; set; } = true;
    public string SectionsJson { get; set; } = "[]";
    public string ExercisesJson { get; set; } = "[]";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Set when edited in the admin; the seeder then leaves the lesson alone.</summary>
    public DateTimeOffset? EditedAt { get; set; }
}
