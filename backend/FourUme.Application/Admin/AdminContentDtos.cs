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

/// <param name="Missing">"image", "has-image", "image-review" (auto-picked, not approved), "example", "ipa", "example-audio" (has example, no current Azure recording), "example-audio-ready".</param>
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
    ImageCreditDto? ImageCredit,
    string ExampleAudioState,
    string? ExampleAudioUrl);

public static class WordExampleAudioStates
{
    /// <summary>No example sentence on the card.</summary>
    public const string Na = "na";
    /// <summary>Has example but no Azure mp3 yet (app uses device TTS).</summary>
    public const string None = "none";
    /// <summary>Example matches <c>ExampleAudioText</c>; app plays the recording.</summary>
    public const string Ready = "ready";
    /// <summary>Example was edited after the mp3 was made; run the example-audio job again.</summary>
    public const string Stale = "stale";
}

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

public record ExampleAudioStatusDto(
    bool Configured,
    bool Running,
    int Done,
    int Total,
    string? Error,
    int Missing,
    int MonthChars,
    int MonthCharLimit);

/// <param name="MaxMonthPercent">Cap this run to at most this share of <see cref="ExampleAudioStatusDto.MonthCharLimit"/> minus chars already used this month; null = use all remaining quota up to the limit.</param>
public record StartExampleAudioRequest(int? MaxMonthPercent);

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
