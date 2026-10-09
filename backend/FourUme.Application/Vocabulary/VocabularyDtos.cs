using FourUme.Domain.Enums;

namespace FourUme.Application.Vocabulary;

/// <param name="Icon">Ionicons glyph name.</param>
public record DeckSummaryDto(
    string Id,
    string TitleVi,
    string Icon,
    int TotalWords,
    int KnownWords,
    int HardWords,
    string? Levels);

/// <param name="Forms">Irregular forms for the card, e.g. "go – went – gone"; null when regular.</param>
public record WordDto(
    string Id,
    string Word,
    string Ipa,
    string Pos,
    string Level,
    string MeaningVi,
    string Example,
    string ExampleVi,
    string? ImageUrl,
    WordStatus Status,
    string? Forms);

/// <param name="MatchedForm">The inflected form the user typed when it led to this base word ("went" for go).</param>
public record WordSearchResultDto(WordDto Word, string DeckId, string DeckTitleVi, string? MatchedForm);

public record UpdateProgressRequest(string WordId, WordStatus Status);
public record UpdateProgressResponse(string WordId, WordStatus Status, DateTimeOffset? NextReviewAt);
