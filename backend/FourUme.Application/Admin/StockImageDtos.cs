namespace FourUme.Application.Admin;

public static class StockSources
{
    public const string Pexels = "pexels";
    public const string Pixabay = "pixabay";
}

/// <summary>A search hit from Pexels / Pixabay; <see cref="PreviewUrl"/> is only for showing results, never stored.</summary>
public record StockImageDto(
    string Source,
    string Id,
    string PreviewUrl,
    int Width,
    int Height,
    string Author,
    string? AuthorUrl,
    string PageUrl,
    string? Description);

/// <param name="Sources">Providers with an API key configured.</param>
/// <param name="Errors">Per-provider problems (e.g. rate limit), shown next to the results.</param>
public record StockSearchResult(string Query, IReadOnlyList<StockImageDto> Items, IReadOnlyList<string> Sources, IReadOnlyList<string> Errors);

public record StockImageRef(string Source, string Id);

/// <summary>Picks images for words without one, in batches the admin page calls repeatedly.</summary>
/// <param name="After">Word id cursor returned by the previous batch.</param>
public record AutoImageRequest(string? Level, string? DeckId, string? Pos, string? After, int? Batch);

public record AutoImageItem(string WordId, string Word, string? ImageUrl, string? Source);

/// <param name="Next">Cursor for the next batch; null when every matching word was tried.</param>
/// <param name="Remaining">Matching words without an image after this batch, not counting the ones already tried.</param>
/// <param name="Warning">Set when a provider stopped answering (e.g. rate limit).</param>
/// <param name="Stopped">Every provider stopped answering; the batch ended early and can be resumed from <paramref name="Next"/>.</param>
public record AutoImageResult(int Assigned, IReadOnlyList<AutoImageItem> Items, string? Next, int Remaining, string? Warning, bool Stopped);

public interface IWordImageService
{
    Task<StockSearchResult> SearchAsync(string query, int page, CancellationToken ct = default);
    /// <summary>Downloads the stock photo into the media library (once per photo) without assigning it.</summary>
    Task<AdminMediaDto> ImportAsync(StockImageRef image, Guid uploadedBy, CancellationToken ct = default);
    /// <summary>Downloads the stock photo and sets it as the word's approved image.</summary>
    Task<AdminWordDto> AssignAsync(string wordId, StockImageRef image, Guid uploadedBy, CancellationToken ct = default);
    Task<AdminWordDto> ApproveAsync(string wordId, CancellationToken ct = default);
    Task<AdminWordDto> RemoveAsync(string wordId, CancellationToken ct = default);
    Task<AutoImageResult> AutoAssignAsync(AutoImageRequest request, Guid uploadedBy, CancellationToken ct = default);
}
