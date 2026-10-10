using FourUme.Application.Auth;

namespace FourUme.Application.Placement;

public static class PlacementRules
{
    public static readonly string[] Levels = ["A1", "A2", "B1", "B2"];
    public const string ModeSkip = "skip";
    public const string ModeKnown = "known";
    public static readonly string[] Modes = [ModeSkip, ModeKnown];

    /// <summary>The app asks at most 6 per level; the rest are spares when a word has no usable distractors.</summary>
    public const int QuestionsPerLevel = 8;
    public const int OptionCount = 4;
    public static readonly string[] QuestionPos = ["noun", "verb", "adjective", "adverb"];

    /// <summary>Words below the start level marked known get their first review spread over this window, so they trickle in.</summary>
    public const int KnownReviewMinDays = 30;
    public const int KnownReviewMaxDays = 365;

    public static int Rank(string? level) => level is null ? -1 : Array.IndexOf(Levels, level);
}

/// <param name="Answer">Index of the correct option; the test only steers the learner's own start level.</param>
public record PlacementQuestionDto(string WordId, string Word, string Ipa, string Pos, IReadOnlyList<string> Options, int Answer);
public record PlacementLevelDto(string Level, IReadOnlyList<PlacementQuestionDto> Questions);

/// <param name="Tested">False when the learner picked the level without taking the test.</param>
public record ApplyPlacementRequest(string Level, string Mode, bool Tested);
public record ApplyPlacementResponse(MeResponse Me, int MarkedKnown, int Cleared);

public interface IPlacementService
{
    Task<IReadOnlyList<PlacementLevelDto>> GetQuestionsAsync(CancellationToken ct = default);
    Task<ApplyPlacementResponse> ApplyAsync(Guid userId, ApplyPlacementRequest request, CancellationToken ct = default);
}
