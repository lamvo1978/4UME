namespace FourUme.Application.Review;

public interface IReviewService
{
    Task<ReviewSummaryDto> GetSummaryAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<ReviewForecastDayDto>> GetForecastAsync(Guid userId, int days, CancellationToken ct = default);
    Task<IReadOnlyList<ReviewItemDto>> GetDueItemsAsync(Guid userId, int limit, CancellationToken ct = default);
    Task<ReviewAnswerResponse> AnswerAsync(Guid userId, ReviewAnswerRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ReviewItemDto>> GetPracticeItemsAsync(Guid userId, PracticeQuery query, CancellationToken ct = default);
    Task<PracticeAnswerResponse> PracticeAnswerAsync(Guid userId, ReviewAnswerRequest request, CancellationToken ct = default);
}
