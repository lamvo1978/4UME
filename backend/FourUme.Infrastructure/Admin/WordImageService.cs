using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Vocabulary;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Admin;

public class WordImageService(
    IAppDbContext db,
    IAdminContentService content,
    StockImageClient stock,
    IOptions<MediaOptions> mediaOptions,
    Auditor auditor,
    ILogger<WordImageService> logger) : IWordImageService
{
    public const int MaxBatch = 20;
    private readonly string _mediaFolder = Path.GetFullPath(mediaOptions.Value.Path);

    public async Task<StockSearchResult> SearchAsync(string query, int page, CancellationToken ct = default)
    {
        query = query?.Trim() ?? "";
        if (query.Length == 0) throw new InvalidOperationException("Nhập từ khoá để tìm ảnh.");
        var sources = RequireSources();

        var searches = sources.Select(async s =>
        {
            try
            {
                return (Photos: await stock.SearchAsync(s, query, page, ct), Error: (string?)null);
            }
            catch (StockProviderException ex)
            {
                return (Photos: (IReadOnlyList<StockPhoto>)[], Error: ex.Message);
            }
        }).ToList();
        var results = await Task.WhenAll(searches);

        // Interleave so both providers show up in the first rows.
        var items = new List<StockImageDto>();
        for (var i = 0; i < StockImageClient.PageSize; i++)
            foreach (var r in results)
                if (i < r.Photos.Count) items.Add(r.Photos[i].Info);
        return new StockSearchResult(query, items, sources, results.Select(r => r.Error).OfType<string>().ToList());
    }

    public async Task<AdminMediaDto> ImportAsync(StockImageRef image, Guid uploadedBy, CancellationToken ct = default)
    {
        var media = await SaveStockAsync(await FindPhotoAsync(image, ct), uploadedBy, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(media, await db.Words.CountAsync(w => w.ImageUrl == media.Url, ct));
    }

    public async Task<AdminWordDto> AssignAsync(string wordId, StockImageRef image, Guid uploadedBy, CancellationToken ct = default)
    {
        var word = await db.Words.FirstOrDefaultAsync(w => w.Id == wordId, ct) ?? throw new KeyNotFoundException();
        var media = await SaveStockAsync(await FindPhotoAsync(image, ct), uploadedBy, ct);
        SetImage(word, media.Url, pending: false);
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
        return (await content.GetWordAsync(wordId, ct))!;
    }

    public async Task<AdminWordDto> ApproveAsync(string wordId, CancellationToken ct = default)
    {
        var word = await db.Words.FirstOrDefaultAsync(w => w.Id == wordId, ct) ?? throw new KeyNotFoundException();
        if (word.ImageUrl is null) throw new InvalidOperationException("Từ này chưa có ảnh.");
        word.ImagePending = false;
        await db.SaveChangesAsync(ct);
        return (await content.GetWordAsync(wordId, ct))!;
    }

    public async Task<AdminWordDto> RemoveAsync(string wordId, CancellationToken ct = default)
    {
        var word = await db.Words.FirstOrDefaultAsync(w => w.Id == wordId, ct) ?? throw new KeyNotFoundException();
        SetImage(word, null, pending: false);
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
        return (await content.GetWordAsync(wordId, ct))!;
    }

    public async Task<AutoImageResult> AutoAssignAsync(AutoImageRequest request, Guid uploadedBy, CancellationToken ct = default)
    {
        var sources = RequireSources().ToList();
        var batch = Math.Clamp(request.Batch ?? 8, 1, MaxBatch);

        var words = await MissingImage(request, request.After).OrderBy(w => w.Id).Take(batch).ToListAsync(ct);

        var items = new List<AutoImageItem>();
        string? warning = null;
        string? last = request.After;
        foreach (var word in words)
        {
            StockPhoto? photo = null;
            foreach (var source in sources.ToList())
            {
                try
                {
                    photo = (await stock.SearchAsync(source, word.Text, 1, ct)).FirstOrDefault();
                }
                catch (StockProviderException ex)
                {
                    sources.Remove(source);
                    warning = ex.Message;
                }
                if (photo is not null) break;
            }
            // Every provider is out of quota: stop here and let the admin resume from this word later.
            if (sources.Count == 0) break;

            last = word.Id;
            if (photo is null)
            {
                items.Add(new AutoImageItem(word.Id, word.Text, null, null));
                continue;
            }
            try
            {
                var media = await SaveStockAsync(photo, uploadedBy, ct);
                SetImage(word, media.Url, pending: true);
                await db.SaveChangesAsync(ct);
                items.Add(new AutoImageItem(word.Id, word.Text, media.Url, photo.Info.Source));
            }
            catch (InvalidOperationException ex)
            {
                // Download or decode failed before anything was tracked; skip the word.
                logger.LogWarning("Auto image for {Word} failed: {Error}", word.Id, ex.Message);
                items.Add(new AutoImageItem(word.Id, word.Text, null, null));
            }
        }
        if (items.Any(i => i.ImageUrl is not null)) WordSearchIndex.Invalidate();

        var stopped = sources.Count == 0;
        var next = stopped || words.Count == batch ? last : null;
        var remaining = next is null ? 0 : await MissingImage(request, last).CountAsync(ct);
        return new AutoImageResult(items.Count(i => i.ImageUrl is not null), items, next, remaining, warning, stopped);
    }

    private IQueryable<Word> MissingImage(AutoImageRequest request, string? after)
    {
        var words = db.Words.Where(w => w.ImageUrl == null || w.ImageUrl == "");
        if (!string.IsNullOrWhiteSpace(request.Level)) words = words.Where(w => w.Level == request.Level);
        if (!string.IsNullOrWhiteSpace(request.DeckId)) words = words.Where(w => w.DeckId == request.DeckId);
        if (!string.IsNullOrWhiteSpace(request.Pos)) words = words.Where(w => w.Pos == request.Pos);
        if (!string.IsNullOrEmpty(after)) words = words.Where(w => string.Compare(w.Id, after) > 0);
        return words;
    }

    private IReadOnlyList<string> RequireSources()
    {
        var sources = stock.Sources;
        if (sources.Count == 0)
            throw new InvalidOperationException("Chưa cấu hình API key Pexels / Pixabay trên máy chủ (StockImages__PexelsKey, StockImages__PixabayKey).");
        return sources;
    }

    private async Task<StockPhoto> FindPhotoAsync(StockImageRef image, CancellationToken ct)
    {
        try
        {
            return await stock.GetAsync(image.Source, image.Id, ct) ?? throw new KeyNotFoundException();
        }
        catch (StockProviderException ex)
        {
            throw new InvalidOperationException(ex.Message);
        }
    }

    /// <summary>Downloads the photo once; later picks of the same photo reuse the stored file.</summary>
    private async Task<MediaFile> SaveStockAsync(StockPhoto photo, Guid uploadedBy, CancellationToken ct)
    {
        var info = photo.Info;
        var existing = await db.MediaFiles.FirstOrDefaultAsync(m => m.Source == info.Source && m.SourceId == info.Id, ct);
        if (existing is not null) return existing;

        var bytes = await stock.DownloadAsync(photo, ct);
        using var input = new MemoryStream(bytes);
        var stored = MediaStorage.SaveImage(input, _mediaFolder, squareCrop: true);
        var media = new MediaFile
        {
            FileName = stored.FileName,
            Url = stored.Url,
            OriginalName = Truncate($"{StockImageClient.Label(info.Source)} {info.Id} · {info.Author}", 255),
            Width = stored.Width,
            Height = stored.Height,
            Bytes = stored.Bytes,
            UploadedBy = uploadedBy,
            Source = info.Source,
            SourceId = info.Id,
            SourceUrl = Truncate(info.PageUrl, 500),
            Author = Truncate(info.Author, 120),
            AuthorUrl = info.AuthorUrl is null ? null : Truncate(info.AuthorUrl, 500),
        };
        db.MediaFiles.Add(media);
        auditor.Record(AuditEntities.Media, media.Id.ToString(), AuditActions.Create, media.OriginalName, null, Auditor.Snapshot(media));
        return media;
    }

    private void SetImage(Word word, string? url, bool pending)
    {
        var before = Auditor.Snapshot(word);
        word.ImageUrl = url;
        word.ImagePending = url is not null && pending;
        // Marks the word as admin-edited so the vocabulary seeder keeps the image.
        word.EditedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Word, word.Id, AuditActions.Update, word.Text, before, Auditor.Snapshot(word));
    }

    private static AdminMediaDto ToDto(MediaFile m, int usedBy) =>
        new(m.Id, m.Url, m.OriginalName, m.Width, m.Height, m.Bytes, m.CreatedAt, usedBy,
            m.Source is null ? null : new ImageCreditDto(m.Source, m.Author, m.AuthorUrl, m.SourceUrl), []);

    private static string Truncate(string s, int max) => s.Length > max ? s[..max] : s;
}
