namespace FourUme.Domain.Entities;

public class Word
{
    public string Id { get; set; } = string.Empty;
    public string DeckId { get; set; } = string.Empty;
    public string DeckTitleVi { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Ipa { get; set; } = string.Empty;
    public string Pos { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string MeaningVi { get; set; } = string.Empty;
    public string Example { get; set; } = string.Empty;
    public string ExampleVi { get; set; } = string.Empty;
}
