namespace FourUme.Application.Grammar;

public interface IGrammarService
{
    Task<IReadOnlyList<GrammarLessonSummaryDto>> GetLessonsAsync(Guid userId, CancellationToken ct = default);
    Task<GrammarLessonDetailDto?> GetLessonAsync(string slug, CancellationToken ct = default);
    Task<GrammarSubmitResponse> SubmitAsync(Guid userId, string slug, GrammarSubmitRequest request, CancellationToken ct = default);
}
