namespace FourUme.Domain.Entities;

/// <summary>A writing task for "Luyện viết với AI"; written by admins, optionally drafted by AI.</summary>
public class WritingPrompt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Level { get; set; } = string.Empty;
    public string TitleVi { get; set; } = string.Empty;
    /// <summary>Ionicons name shown on the card.</summary>
    public string Icon { get; set; } = "create-outline";
    /// <summary>The task in English, shown to the learner and sent to the AI.</summary>
    public string PromptEn { get; set; } = string.Empty;
    /// <summary>Short Vietnamese guidance (what to include).</summary>
    public string GuideVi { get; set; } = string.Empty;
    public int MinWords { get; set; }
    public int MaxWords { get; set; }
    public List<string> KeyPhrases { get; set; } = [];
    public bool Published { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>One paragraph a learner sent for grading, with the AI's result.</summary>
public class WritingSubmission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>Null for free writing; set to null when the prompt is deleted.</summary>
    public Guid? PromptId { get; set; }
    public WritingPrompt? Prompt { get; set; }
    /// <summary>The learner's own topic in free writing.</summary>
    public string? Topic { get; set; }
    public string Level { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public int WordCount { get; set; }
    /// <summary>0–100 from the AI.</summary>
    public int Score { get; set; }
    /// <summary>The full grading (scores, corrections, rewrite, upgrades) as JSON.</summary>
    public string Result { get; set; } = "{}";
    /// <summary>The AI model that graded it, for the admin's statistics.</summary>
    public string Model { get; set; } = string.Empty;
    /// <summary>The submission this one rewrites ("Viết lại bài này").</summary>
    public Guid? ParentId { get; set; }
    /// <summary>The learner's calendar day (allowance resets at local midnight).</summary>
    public DateOnly LocalDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
