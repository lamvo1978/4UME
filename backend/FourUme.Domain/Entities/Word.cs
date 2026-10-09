namespace FourUme.Domain.Entities;

public class Word
{
    public string Id { get; set; } = string.Empty;
    public string DeckId { get; set; } = string.Empty;
    public Deck Deck { get; set; } = null!;
    public string Text { get; set; } = string.Empty;
    public string Ipa { get; set; } = string.Empty;
    public string Pos { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string MeaningVi { get; set; } = string.Empty;
    public string Example { get; set; } = string.Empty;
    public string ExampleVi { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    /// <summary>Set when the image was picked automatically; the app hides it until an admin approves it.</summary>
    public bool ImagePending { get; set; }
    /// <summary>The image learners see (pending auto-picked images are hidden).</summary>
    public string? PublicImageUrl => ImagePending ? null : ImageUrl;
    public int SortOrder { get; set; }
    /// <summary>Hidden words drop out of decks and search but stay in review for people who learned them.</summary>
    public bool Published { get; set; } = true;
    /// <summary>Set when changed in the admin; the seeder then never overwrites the word.</summary>
    public DateTimeOffset? EditedAt { get; set; }
}
