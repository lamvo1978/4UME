namespace FourUme.Domain.Entities;

/// <summary>A multiple-choice question for the grammar part of the placement test; written by admins (optionally drafted by AI).</summary>
public class PlacementGrammarQuestion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Level { get; set; } = string.Empty;
    /// <summary>A sentence with ___ for the gap, or an instruction when the options are whole sentences.</summary>
    public string Prompt { get; set; } = string.Empty;
    public List<string> Options { get; set; } = [];
    /// <summary>One of <see cref="Options"/>; the canonical correct choice shown in the editor.</summary>
    public string Answer { get; set; } = string.Empty;
    /// <summary>Other options that are also grammatically correct (e.g. will vs be going to).</summary>
    public List<string> AcceptedAnswers { get; set; } = [];
    public string ExplanationVi { get; set; } = string.Empty;
    /// <summary>Grammar lesson the question tests; a wrong answer suggests starting there.</summary>
    public string? LessonSlug { get; set; }
    public bool Published { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
