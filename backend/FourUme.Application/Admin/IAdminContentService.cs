namespace FourUme.Application.Admin;

/// <summary>Vocabulary content management for the web admin. Validation errors throw InvalidOperationException.</summary>
public interface IAdminContentService
{
    Task<VocabularyMetaDto> GetMetaAsync(CancellationToken ct = default);

    Task<IReadOnlyList<AdminDeckDto>> GetDecksAsync(CancellationToken ct = default);
    Task<AdminDeckDto> CreateDeckAsync(SaveDeckRequest request, CancellationToken ct = default);
    Task<AdminDeckDto> UpdateDeckAsync(string id, SaveDeckRequest request, CancellationToken ct = default);
    Task ReorderDecksAsync(ReorderRequest request, CancellationToken ct = default);
    /// <summary>Only empty decks can be deleted.</summary>
    Task DeleteDeckAsync(string id, CancellationToken ct = default);
    /// <summary>Writes a deck snapshot back, recreating the deck if it was deleted.</summary>
    Task RestoreDeckAsync(DeckSnapshot snapshot, CancellationToken ct = default);

    Task<PagedResult<AdminWordDto>> GetWordsAsync(AdminWordQuery query, CancellationToken ct = default);
    Task<AdminWordDto?> GetWordAsync(string id, CancellationToken ct = default);
    Task<AdminWordDto> CreateWordAsync(SaveWordRequest request, CancellationToken ct = default);
    Task<AdminWordDto> UpdateWordAsync(string id, SaveWordRequest request, CancellationToken ct = default);
    /// <summary>Words someone has studied can't be deleted (hide them instead).</summary>
    Task DeleteWordAsync(string id, CancellationToken ct = default);
    /// <summary>Writes a word snapshot back under its original id, recreating it if it was deleted.</summary>
    Task RestoreWordAsync(WordSnapshot snapshot, CancellationToken ct = default);
    /// <summary>Every word matching the filters (paging ignored), in deck and word order.</summary>
    Task<IReadOnlyList<ExportWordDto>> ExportWordsAsync(AdminWordQuery query, CancellationToken ct = default);
    /// <summary>Validates spreadsheet rows and, when requested, saves every row without errors.</summary>
    Task<ImportWordsResult> ImportWordsAsync(ImportWordsRequest request, CancellationToken ct = default);

    Task<IReadOnlyList<AdminMediaDto>> GetMediaAsync(CancellationToken ct = default);
    Task<AdminMediaDto> UploadMediaAsync(Stream content, string originalName, bool squareCrop, Guid uploadedBy, CancellationToken ct = default);
    /// <summary>Only images no word uses can be deleted.</summary>
    Task DeleteMediaAsync(Guid id, CancellationToken ct = default);
}
