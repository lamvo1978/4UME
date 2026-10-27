namespace FourUme.Domain.Entities;

/// <summary>A role-play situation for "Đàm thoại với AI"; written by admins, optionally drafted by AI.</summary>
public class ConversationScenario
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Level { get; set; } = string.Empty;
    public string TitleVi { get; set; } = string.Empty;
    /// <summary>Ionicons name shown on the card.</summary>
    public string Icon { get; set; } = "chatbubbles-outline";
    /// <summary>English description of the place and situation, for the AI only.</summary>
    public string Situation { get; set; } = string.Empty;
    /// <summary>Who the AI plays, in English ("a friendly barista").</summary>
    public string AiRole { get; set; } = string.Empty;
    /// <summary>What the learner should get done, shown in Vietnamese.</summary>
    public string GoalVi { get; set; } = string.Empty;
    /// <summary>The AI's first line, in English.</summary>
    public string Opening { get; set; } = string.Empty;
    public List<string> KeyPhrases { get; set; } = [];
    public bool Published { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>One talk between a learner and the AI: a role-play (<see cref="ScenarioId"/> set) or free talk.</summary>
public class Conversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>Null for free talk; set to null when the scenario is deleted.</summary>
    public Guid? ScenarioId { get; set; }
    public ConversationScenario? Scenario { get; set; }
    public string Level { get; set; } = string.Empty;
    /// <summary>Quota bucket for this talk: first, streak_gift, premium, or addon; null on sessions started before Phase 2.</summary>
    public string? SessionKind { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }
    /// <summary>Messages the learner sent (each one used a turn of the daily allowance).</summary>
    public int LearnerTurns { get; set; }
    /// <summary>0–100 from the end-of-talk summary.</summary>
    public int? Score { get; set; }
    /// <summary>The end-of-talk summary as JSON.</summary>
    public string? Summary { get; set; }
    public List<ConversationTurn> Turns { get; set; } = [];
}

/// <summary>One message in a conversation, from the learner or the AI.</summary>
public class ConversationTurn
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    /// <summary>Copied from the conversation so the daily allowance is one indexed count.</summary>
    public Guid UserId { get; set; }
    /// <summary>Position in the conversation, from 0.</summary>
    public int Index { get; set; }
    public bool FromLearner { get; set; }
    public string Text { get; set; } = string.Empty;
    /// <summary>Learner turns: the AI's correction as JSON, null when the sentence was fine.</summary>
    public string? Correction { get; set; }
    /// <summary>AI turns: a Vietnamese hint for what to say next.</summary>
    public string? HintVi { get; set; }
    /// <summary>AI turns: sample replies the learner could say next, as JSON.</summary>
    public string? Suggestions { get; set; }
    /// <summary>The learner's calendar day (allowance resets at local midnight).</summary>
    public DateOnly LocalDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>Azure characters billed to read this AI turn aloud; 0 when the phone's voice reads it.</summary>
    public int TtsChars { get; set; }
    /// <summary>Read on the paid (S0) resource after the free share ran out.</summary>
    public bool TtsPaid { get; set; }
}
