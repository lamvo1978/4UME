namespace FourUme.Application.Vocabulary;

public interface IVocabularyService
{
    Task<IReadOnlyList<DeckSummaryDto>> GetDecksAsync(Guid userId, string? level, CancellationToken ct = default);
    Task<IReadOnlyList<WordDto>> GetDeckWordsAsync(Guid userId, string deckId, CancellationToken ct = default);
    Task<UpdateProgressResponse> UpdateProgressAsync(Guid userId, UpdateProgressRequest request, CancellationToken ct = default);
}
