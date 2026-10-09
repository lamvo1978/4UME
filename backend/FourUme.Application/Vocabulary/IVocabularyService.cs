namespace FourUme.Application.Vocabulary;

public interface IVocabularyService
{
    Task<IReadOnlyList<DeckSummaryDto>> GetDecksAsync(Guid userId, string? level, CancellationToken ct = default);
    Task<IReadOnlyList<WordDto>> GetDeckWordsAsync(Guid userId, string deckId, CancellationToken ct = default);
    /// <summary>Searches the app's own word list by English word or Vietnamese meaning (diacritics optional).</summary>
    Task<IReadOnlyList<WordSearchResultDto>> SearchAsync(Guid userId, string query, int limit, CancellationToken ct = default);
    Task<UpdateProgressResponse> UpdateProgressAsync(Guid userId, UpdateProgressRequest request, CancellationToken ct = default);
}
