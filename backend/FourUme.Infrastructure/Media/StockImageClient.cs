using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using FourUme.Application.Admin;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Media;

public class StockImageOptions
{
    public const string SectionName = "StockImages";
    public string? PexelsKey { get; set; }
    public string? PixabayKey { get; set; }
}

/// <summary>A stock photo with the URL to download (the larger rendition) besides the preview.</summary>
public record StockPhoto(StockImageDto Info, string DownloadUrl);

/// <summary>The provider refused the request (rate limit, bad key); other providers may still answer.</summary>
public class StockProviderException(string provider, string message) : Exception(message)
{
    public string Provider { get; } = provider;
}

/// <summary>
/// Pexels and Pixabay search. Results are cached for 24 hours (required by Pixabay, and it keeps
/// within Pexels' 200 requests/hour); photos are always downloaded to our media folder, never hotlinked.
/// </summary>
public class StockImageClient(HttpClient http, IOptions<StockImageOptions> options, IMemoryCache cache, ILogger<StockImageClient> logger)
{
    public const int PageSize = 12;
    private const long MaxDownloadBytes = MediaOptions.MaxUploadBytes;
    private static readonly TimeSpan CacheFor = TimeSpan.FromHours(24);
    private static readonly string[] DownloadHosts = ["images.pexels.com", "pixabay.com", "cdn.pixabay.com"];

    private readonly string? _pexelsKey = Blank(options.Value.PexelsKey);
    private readonly string? _pixabayKey = Blank(options.Value.PixabayKey);

    /// <summary>Configured providers, Pexels first (its photos suit flashcards better).</summary>
    public IReadOnlyList<string> Sources =>
        new[] { _pexelsKey is null ? null : StockSources.Pexels, _pixabayKey is null ? null : StockSources.Pixabay }
            .OfType<string>().ToList();

    public static string Label(string source) => source == StockSources.Pexels ? "Pexels" : "Pixabay";

    public async Task<IReadOnlyList<StockPhoto>> SearchAsync(string source, string query, int page, CancellationToken ct)
    {
        query = query.Trim();
        if (query.Length > 100) query = query[..100];
        page = Math.Clamp(page, 1, 20);
        var key = $"stock:search:{source}:{page}:{query.ToLowerInvariant()}";
        if (cache.TryGetValue(key, out IReadOnlyList<StockPhoto>? cached) && cached is not null) return cached;

        var photos = source switch
        {
            StockSources.Pexels => await SearchPexelsAsync(query, page, ct),
            StockSources.Pixabay => await SearchPixabayAsync(query, page, ct),
            _ => throw new InvalidOperationException("Nguồn ảnh không hợp lệ."),
        };
        cache.Set(key, photos, CacheFor);
        foreach (var p in photos) cache.Set(PhotoKey(p.Info.Source, p.Info.Id), p, CacheFor);
        return photos;
    }

    /// <summary>A photo seen in a recent search, or looked up by id.</summary>
    public async Task<StockPhoto?> GetAsync(string source, string id, CancellationToken ct)
    {
        if (cache.TryGetValue(PhotoKey(source, id), out StockPhoto? cached) && cached is not null) return cached;
        if (!long.TryParse(id, out _)) return null;
        var photo = source switch
        {
            StockSources.Pexels => await GetPexelsAsync(id, ct),
            StockSources.Pixabay => (await QueryPixabayAsync($"&id={id}", ct)).FirstOrDefault(),
            _ => null,
        };
        if (photo is not null) cache.Set(PhotoKey(source, id), photo, CacheFor);
        return photo;
    }

    public async Task<byte[]> DownloadAsync(StockPhoto photo, CancellationToken ct)
    {
        if (!Uri.TryCreate(photo.DownloadUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps
            || !DownloadHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Đường dẫn ảnh không hợp lệ.");

        using var response = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Không tải được ảnh ({(int)response.StatusCode}).");
        if (response.Content.Headers.ContentLength > MaxDownloadBytes) throw new InvalidOperationException("Ảnh quá lớn.");

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxDownloadBytes) throw new InvalidOperationException("Ảnh quá lớn.");
            buffer.Write(chunk, 0, read);
        }
        return buffer.ToArray();
    }

    // ---------- Pexels ----------

    private async Task<IReadOnlyList<StockPhoto>> SearchPexelsAsync(string query, int page, CancellationToken ct)
    {
        var url = $"https://api.pexels.com/v1/search?query={Uri.EscapeDataString(query)}&per_page={PageSize}&page={page}&locale=en-US";
        var result = await SendAsync<PexelsSearch>(StockSources.Pexels, PexelsRequest(url), ct);
        return result?.Photos?.Select(FromPexels).ToList() ?? [];
    }

    private async Task<StockPhoto?> GetPexelsAsync(string id, CancellationToken ct)
    {
        var photo = await SendAsync<PexelsPhoto>(StockSources.Pexels, PexelsRequest($"https://api.pexels.com/v1/photos/{id}"), ct);
        return photo is null ? null : FromPexels(photo);
    }

    private HttpRequestMessage PexelsRequest(string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("Authorization", _pexelsKey);
        return request;
    }

    private static StockPhoto FromPexels(PexelsPhoto p) => new(
        new StockImageDto(StockSources.Pexels, p.Id.ToString(), p.Src.Medium, p.Width, p.Height,
            p.Photographer, p.PhotographerUrl, p.Url, Blank(p.Alt)),
        p.Src.Large2x);

    private record PexelsSearch([property: JsonPropertyName("photos")] List<PexelsPhoto>? Photos);

    private record PexelsPhoto(
        [property: JsonPropertyName("id")] long Id,
        [property: JsonPropertyName("width")] int Width,
        [property: JsonPropertyName("height")] int Height,
        [property: JsonPropertyName("url")] string Url,
        [property: JsonPropertyName("photographer")] string Photographer,
        [property: JsonPropertyName("photographer_url")] string? PhotographerUrl,
        [property: JsonPropertyName("alt")] string? Alt,
        [property: JsonPropertyName("src")] PexelsSrc Src);

    private record PexelsSrc(
        [property: JsonPropertyName("large2x")] string Large2x,
        [property: JsonPropertyName("medium")] string Medium);

    // ---------- Pixabay ----------

    private Task<IReadOnlyList<StockPhoto>> SearchPixabayAsync(string query, int page, CancellationToken ct) =>
        QueryPixabayAsync($"&q={Uri.EscapeDataString(query)}&per_page={PageSize}&page={page}", ct);

    private async Task<IReadOnlyList<StockPhoto>> QueryPixabayAsync(string args, CancellationToken ct)
    {
        var url = $"https://pixabay.com/api/?key={Uri.EscapeDataString(_pixabayKey ?? "")}&image_type=photo&safesearch=true&lang=en{args}";
        var result = await SendAsync<PixabaySearch>(StockSources.Pixabay, new HttpRequestMessage(HttpMethod.Get, url), ct);
        return result?.Hits?.Select(h => new StockPhoto(
            new StockImageDto(StockSources.Pixabay, h.Id.ToString(), h.WebformatUrl, h.ImageWidth, h.ImageHeight,
                h.User, $"https://pixabay.com/users/{h.User}-{h.UserId}/", h.PageUrl, Blank(h.Tags)),
            h.LargeImageUrl)).ToList() ?? [];
    }

    private record PixabaySearch([property: JsonPropertyName("hits")] List<PixabayHit>? Hits);

    private record PixabayHit(
        [property: JsonPropertyName("id")] long Id,
        [property: JsonPropertyName("pageURL")] string PageUrl,
        [property: JsonPropertyName("webformatURL")] string WebformatUrl,
        [property: JsonPropertyName("largeImageURL")] string LargeImageUrl,
        [property: JsonPropertyName("imageWidth")] int ImageWidth,
        [property: JsonPropertyName("imageHeight")] int ImageHeight,
        [property: JsonPropertyName("user")] string User,
        [property: JsonPropertyName("user_id")] long UserId,
        [property: JsonPropertyName("tags")] string? Tags);

    // ---------- Helpers ----------

    private async Task<T?> SendAsync<T>(string source, HttpRequestMessage request, CancellationToken ct)
    {
        if ((source == StockSources.Pexels ? _pexelsKey : _pixabayKey) is null)
            throw new StockProviderException(source, $"{Label(source)}: chưa có API key.");
        using (request)
        {
            HttpResponseMessage response;
            try
            {
                response = await http.SendAsync(request, ct);
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "{Source} request failed", source);
                throw new StockProviderException(source, $"{Label(source)}: không kết nối được.");
            }
            using (response)
            {
                if (response.StatusCode == HttpStatusCode.NotFound) return default;
                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                    throw new StockProviderException(source, $"{Label(source)}: hết lượt tìm, thử lại sau ít phút.");
                if (!response.IsSuccessStatusCode)
                {
                    // Pixabay answers a bad key with 400 "Invalid or missing API key".
                    var body = await response.Content.ReadAsStringAsync(ct);
                    if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
                        || body.Contains("API key", StringComparison.OrdinalIgnoreCase))
                        throw new StockProviderException(source, $"{Label(source)}: API key không hợp lệ.");
                    logger.LogWarning("{Source} returned {Status}: {Body}", source, (int)response.StatusCode, body.Length > 200 ? body[..200] : body);
                    throw new StockProviderException(source, $"{Label(source)}: lỗi máy chủ ({(int)response.StatusCode}).");
                }
                return await response.Content.ReadFromJsonAsync<T>(ct);
            }
        }
    }

    private static string PhotoKey(string source, string id) => $"stock:photo:{source}:{id}";

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
