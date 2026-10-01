using FourUme.Domain.Enums;

namespace FourUme.Application.Vocabulary;

public record DeckSummaryDto(
    string Id,
    string TitleVi,
    int TotalWords,
    int KnownWords,
    int HardWords,
    string? Levels);

public record WordDto(
    string Id,
    string Word,
    string Ipa,
    string Pos,
    string Level,
    string MeaningVi,
    string Example,
    string ExampleVi,
    WordStatus Status);

public record UpdateProgressRequest(string WordId, WordStatus Status);
public record UpdateProgressResponse(string WordId, WordStatus Status, DateTimeOffset? NextReviewAt);
