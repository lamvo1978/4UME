namespace FourUme.Application.Admin;

public static class ContentRules
{
    public static readonly string[] PartsOfSpeech =
        ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "determiner", "conjunction", "interjection", "number"];
    public static readonly string[] Levels = ["A1", "A2", "B1", "B2", "C1"];
    public const int MaxPageSize = 200;
    /// <summary>Longest word that still gets the letter-assembly exercise in the app.</summary>
    public const int MaxAssembleLength = 12;
}

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record VocabularyMetaDto(IReadOnlyList<string> PartsOfSpeech, IReadOnlyList<string> Levels, IReadOnlyList<AdminDeckOptionDto> Decks);
public record AdminDeckOptionDto(string Id, string TitleVi);

public record AdminDeckDto(
    string Id,
    string TitleVi,
    string Icon,
    int SortOrder,
    bool Published,
    int WordCount,
    int HiddenWords,
    string? Levels);

/// <param name="Id">Only used when creating; a slug of the title is generated when empty.</param>
public record SaveDeckRequest(string? Id, string TitleVi, string Icon, bool Published);

public record ReorderRequest(IReadOnlyList<string> Ids);

/// <param name="Missing">"image", "image-review" (auto-picked, not approved), "example" or "ipa".</param>
/// <param name="Published">null = all, true = visible only, false = hidden only.</param>
public record AdminWordQuery(
    string? Q,
    string? DeckId,
    string? Level,
    string? Pos,
    string? Missing,
    bool? Published,
    int Page = 1,
    int PageSize = 50);

/// <param name="Learners">Users with progress on this word; such words can only be hidden, not deleted.</param>
/// <param name="ImagePending">Picked automatically and not yet approved; the app hides it.</param>
/// <param name="ImageCredit">Source and author of a stock image.</param>
public record AdminWordDto(
    string Id,
    string DeckId,
    string DeckTitleVi,
    string Word,
    string Ipa,
    string Pos,
    string Level,
    string MeaningVi,
    string Example,
    string ExampleVi,
    string? ImageUrl,
    int SortOrder,
    bool Published,
    DateTimeOffset? EditedAt,
    int Learners,
    bool ImagePending,
    ImageCreditDto? ImageCredit);

public record ImageCreditDto(string Source, string? Author, string? AuthorUrl, string? SourceUrl);

public record SaveWordRequest(
    string DeckId,
    string Word,
    string Ipa,
    string Pos,
    string Level,
    string MeaningVi,
    string Example,
    string ExampleVi,
    string? ImageUrl,
    bool Published);

public record AdminMediaDto(
    Guid Id,
    string Url,
    string OriginalName,
    int Width,
    int Height,
    long Bytes,
    DateTimeOffset CreatedAt,
    int UsedBy,
    ImageCreditDto? Credit,
    /// <summary>First few words using the image (UsedBy has the full count).</summary>
    IReadOnlyList<MediaWordDto> Words);

public record MediaWordDto(string Id, string Word, string Level, string DeckTitle);

/// <summary>Thrown when a request conflicts with existing data (maps to HTTP 409).</summary>
public class ContentConflictException(string message) : Exception(message);
