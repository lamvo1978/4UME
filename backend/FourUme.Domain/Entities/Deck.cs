namespace FourUme.Domain.Entities;

public class Deck
{
    /// <summary>Slug, e.g. "food-drink". Immutable: the app and user progress reference it.</summary>
    public string Id { get; set; } = string.Empty;
    public string TitleVi { get; set; } = string.Empty;
    /// <summary>Ionicons glyph name shown in the app, e.g. "restaurant-outline".</summary>
    public string Icon { get; set; } = "albums-outline";
    public int SortOrder { get; set; }
    public bool Published { get; set; } = true;
    /// <summary>Set when changed in the admin; the seeder then leaves the deck alone.</summary>
    public DateTimeOffset? EditedAt { get; set; }

    public ICollection<Word> Words { get; set; } = new List<Word>();
}
