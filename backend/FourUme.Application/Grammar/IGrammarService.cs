using FourUme.Application.Review;

namespace FourUme.Application.Grammar;

public interface IGrammarService
{
    Task<IReadOnlyList<GrammarLessonSummaryDto>> GetLessonsAsync(Guid userId, CancellationToken ct = default);
    Task<GrammarLessonDetailDto?> GetLessonAsync(Guid userId, string slug, CancellationToken ct = default);
    Task<GrammarCompleteResponse> CompleteAsync(Guid userId, string slug, GrammarCompleteRequest request, CancellationToken ct = default);

    Task<ReviewSummaryDto> GetReviewSummaryAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<GrammarReviewItemDto>> GetDueAsync(Guid userId, int limit, CancellationToken ct = default);
    Task<IReadOnlyList<GrammarReviewItemDto>> GetPracticeAsync(Guid userId, string? slug, int limit, CancellationToken ct = default);
    Task<GrammarReviewAnswerResponse> AnswerReviewAsync(Guid userId, GrammarReviewAnswerRequest request, CancellationToken ct = default);
    Task<GrammarReviewAnswerResponse> AnswerPracticeAsync(Guid userId, GrammarReviewAnswerRequest request, CancellationToken ct = default);

    /// <param name="scope"><see cref="GrammarMixedScopes.Learned"/> or a CEFR level (A1–B2).</param>
    Task<IReadOnlyList<GrammarReviewItemDto>> GetMixedAsync(Guid userId, string scope, int limit, CancellationToken ct = default);
    Task<GrammarMixedCompleteResponse> CompleteMixedAsync(Guid userId, GrammarMixedCompleteRequest request, CancellationToken ct = default);
}
