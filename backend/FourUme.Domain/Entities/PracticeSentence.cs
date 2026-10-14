namespace FourUme.Domain.Entities;

/// <summary>A sentence for the Luyện tab (listen and write it, or listen and say it); written by admins, optionally drafted by AI.</summary>
public class PracticeSentence
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Level { get; set; } = string.Empty;
    /// <summary>Short Vietnamese topic label ("Du lịch", "Công việc"); empty for none.</summary>
    public string Topic { get; set; } = string.Empty;
    public string En { get; set; } = string.Empty;
    public string Vi { get; set; } = string.Empty;
    /// <summary>Azure voice used for <see cref="AudioUrl"/>.</summary>
    public string? Voice { get; set; }
    /// <summary>"/media/sentences/…mp3"; null until generated (the app falls back to the phone's voice).</summary>
    public string? AudioUrl { get; set; }
    /// <summary>The English text the audio was made from; audio is stale when it differs from <see cref="En"/>.</summary>
    public string? AudioText { get; set; }
    public bool Published { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
