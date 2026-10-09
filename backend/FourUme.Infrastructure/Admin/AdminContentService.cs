using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Vocabulary;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Admin;

public partial class AdminContentService(IAppDbContext db, IOptions<MediaOptions> mediaOptions, Auditor auditor) : IAdminContentService
{
    private readonly string _mediaFolder = Path.GetFullPath(mediaOptions.Value.Path);

    public async Task<VocabularyMetaDto> GetMetaAsync(CancellationToken ct = default)
    {
        var decks = await db.Decks.AsNoTracking()
            .OrderBy(d => d.SortOrder).ThenBy(d => d.TitleVi)
            .Select(d => new AdminDeckOptionDto(d.Id, d.TitleVi))
            .ToListAsync(ct);
        return new VocabularyMetaDto(ContentRules.PartsOfSpeech, ContentRules.Levels, decks);
    }

    // ---------- Decks ----------

    public async Task<IReadOnlyList<AdminDeckDto>> GetDecksAsync(CancellationToken ct = default)
    {
        var stats = await db.Words.AsNoTracking()
            .GroupBy(w => w.DeckId)
            .Select(g => new
            {
                DeckId = g.Key,
                Total = g.Count(),
                Hidden = g.Count(w => !w.Published),
                Levels = string.Join(",", g.Select(x => x.Level).Distinct().OrderBy(x => x)),
            })
            .ToDictionaryAsync(x => x.DeckId, ct);

        var decks = await db.Decks.AsNoTracking().OrderBy(d => d.SortOrder).ThenBy(d => d.TitleVi).ToListAsync(ct);
        return decks.Select(d =>
        {
            var s = stats.GetValueOrDefault(d.Id);
            return new AdminDeckDto(d.Id, d.TitleVi, d.Icon, d.SortOrder, d.Published, s?.Total ?? 0, s?.Hidden ?? 0, s?.Levels);
        }).ToList();
    }

    public async Task<AdminDeckDto> CreateDeckAsync(SaveDeckRequest request, CancellationToken ct = default)
    {
        var title = Required(request.TitleVi, "Tên bộ", 120);
        var id = Slug(string.IsNullOrWhiteSpace(request.Id) ? WordSearchIndex.Fold(title.ToLowerInvariant()) : request.Id);
        if (id.Length == 0) throw new InvalidOperationException("Mã bộ không hợp lệ.");
        if (await db.Decks.AnyAsync(d => d.Id == id, ct)) throw new InvalidOperationException($"Mã bộ \"{id}\" đã tồn tại.");

        var order = await db.Decks.Select(d => (int?)d.SortOrder).MaxAsync(ct) ?? -1;
        var deck = new Deck
        {
            Id = id,
            TitleVi = title,
            Icon = Icon(request.Icon),
            Published = request.Published,
            SortOrder = order + 1,
            EditedAt = DateTimeOffset.UtcNow,
        };
        db.Decks.Add(deck);
        auditor.Record(AuditEntities.Deck, id, AuditActions.Create, title, null, Auditor.Snapshot(deck));
        await db.SaveChangesAsync(ct);
        return (await GetDecksAsync(ct)).First(d => d.Id == id);
    }

    public async Task<AdminDeckDto> UpdateDeckAsync(string id, SaveDeckRequest request, CancellationToken ct = default)
    {
        var deck = await db.Decks.FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new KeyNotFoundException();
        var before = Auditor.Snapshot(deck);
        ApplyDeck(deck, request.TitleVi, request.Icon, request.Published);
        auditor.Record(AuditEntities.Deck, id, AuditActions.Update, deck.TitleVi, before, Auditor.Snapshot(deck));
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
        return (await GetDecksAsync(ct)).First(d => d.Id == id);
    }

    public async Task RestoreDeckAsync(DeckSnapshot snapshot, CancellationToken ct = default)
    {
        var deck = await db.Decks.FirstOrDefaultAsync(d => d.Id == snapshot.Id, ct);
        var before = deck is null ? null : Auditor.Snapshot(deck);
        if (deck is null)
        {
            deck = new Deck { Id = snapshot.Id, SortOrder = (await db.Decks.Select(d => (int?)d.SortOrder).MaxAsync(ct) ?? -1) + 1 };
            db.Decks.Add(deck);
        }
        ApplyDeck(deck, snapshot.TitleVi, snapshot.Icon, snapshot.Published);
        auditor.Record(AuditEntities.Deck, deck.Id, AuditActions.Restore, deck.TitleVi, before, Auditor.Snapshot(deck));
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
    }

    private static void ApplyDeck(Deck deck, string? title, string? icon, bool published)
    {
        deck.TitleVi = Required(title, "Tên bộ", 120);
        deck.Icon = Icon(icon);
        deck.Published = published;
        deck.EditedAt = DateTimeOffset.UtcNow;
    }

    public async Task ReorderDecksAsync(ReorderRequest request, CancellationToken ct = default)
    {
        var decks = await db.Decks.ToDictionaryAsync(d => d.Id, ct);
        var order = 0;
        foreach (var id in request.Ids.Distinct())
        {
            if (!decks.TryGetValue(id, out var deck)) continue;
            deck.SortOrder = order++;
            deck.EditedAt = DateTimeOffset.UtcNow;
        }
        // Decks missing from the request keep their relative order after the listed ones.
        foreach (var deck in decks.Values.Where(d => !request.Ids.Contains(d.Id)).OrderBy(d => d.SortOrder))
            deck.SortOrder = order++;
        auditor.Record(AuditEntities.Deck, "*", AuditActions.Reorder, "Đổi thứ tự bộ từ", null, null);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteDeckAsync(string id, CancellationToken ct = default)
    {
        var deck = await db.Decks.FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new KeyNotFoundException();
        var words = await db.Words.CountAsync(w => w.DeckId == id, ct);
        if (words > 0) throw new ContentConflictException($"Bộ còn {words} từ. Hãy chuyển hoặc xoá các từ trước, hoặc ẩn bộ.");
        db.Decks.Remove(deck);
        auditor.Record(AuditEntities.Deck, id, AuditActions.Delete, deck.TitleVi, Auditor.Snapshot(deck), null);
        await db.SaveChangesAsync(ct);
    }

    // ---------- Words ----------

    public async Task<PagedResult<AdminWordDto>> GetWordsAsync(AdminWordQuery query, CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.PageSize, 1, ContentRules.MaxPageSize);
        var words = Filter(db.Words.AsNoTracking(), query);
        var total = await words.CountAsync(ct);
        var items = await Project(words.OrderBy(w => w.Deck.SortOrder).ThenBy(w => w.SortOrder).Skip((page - 1) * size).Take(size))
            .ToListAsync(ct);
        return new PagedResult<AdminWordDto>(items, total, page, size);
    }

    public async Task<IReadOnlyList<ExportWordDto>> ExportWordsAsync(AdminWordQuery query, CancellationToken ct = default) =>
        await Filter(db.Words.AsNoTracking(), query)
            .OrderBy(w => w.Deck.SortOrder).ThenBy(w => w.SortOrder)
            .Select(w => new ExportWordDto(w.Id, w.Text, w.Pos, w.Level, w.DeckId, w.Deck.TitleVi, w.MeaningVi, w.Ipa,
                w.Example, w.ExampleVi, w.ImageUrl, w.Published))
            .ToListAsync(ct);

    private static IQueryable<Word> Filter(IQueryable<Word> words, AdminWordQuery query)
    {
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var q = $"%{query.Q.Trim()}%";
            words = words.Where(w => EF.Functions.ILike(w.Text, q) || EF.Functions.ILike(w.MeaningVi, q) || EF.Functions.ILike(w.Id, q));
        }
        if (!string.IsNullOrWhiteSpace(query.DeckId)) words = words.Where(w => w.DeckId == query.DeckId);
        if (!string.IsNullOrWhiteSpace(query.Level)) words = words.Where(w => w.Level == query.Level);
        if (!string.IsNullOrWhiteSpace(query.Pos)) words = words.Where(w => w.Pos == query.Pos);
        if (query.Published is { } published) words = words.Where(w => w.Published == published);
        return query.Missing switch
        {
            "image" => words.Where(w => w.ImageUrl == null || w.ImageUrl == ""),
            "image-review" => words.Where(w => w.ImagePending),
            "example" => words.Where(w => w.Example == "" || w.ExampleVi == ""),
            "ipa" => words.Where(w => w.Ipa == ""),
            _ => words,
        };
    }

    public async Task<AdminWordDto?> GetWordAsync(string id, CancellationToken ct = default) =>
        await Project(db.Words.AsNoTracking().Where(w => w.Id == id)).FirstOrDefaultAsync(ct);

    public async Task<AdminWordDto> CreateWordAsync(SaveWordRequest request, CancellationToken ct = default)
    {
        var word = new Word();
        await ApplyAsync(word, request, ct);
        var baseId = $"{Slug(word.Text)}-{word.Pos}";
        word.Id = baseId;
        for (var n = 2; await db.Words.AnyAsync(w => w.Id == word.Id, ct); n++)
            word.Id = $"{baseId}-{n}";
        word.SortOrder = (await db.Words.Select(w => (int?)w.SortOrder).MaxAsync(ct) ?? -1) + 1;
        db.Words.Add(word);
        auditor.Record(AuditEntities.Word, word.Id, AuditActions.Create, word.Text, null, Auditor.Snapshot(word));
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
        return (await GetWordAsync(word.Id, ct))!;
    }

    public async Task<AdminWordDto> UpdateWordAsync(string id, SaveWordRequest request, CancellationToken ct = default)
    {
        var word = await db.Words.FirstOrDefaultAsync(w => w.Id == id, ct) ?? throw new KeyNotFoundException();
        var before = Auditor.Snapshot(word);
        await ApplyAsync(word, request, ct);
        auditor.Record(AuditEntities.Word, id, AuditActions.Update, word.Text, before, Auditor.Snapshot(word));
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
        return (await GetWordAsync(id, ct))!;
    }

    public async Task DeleteWordAsync(string id, CancellationToken ct = default)
    {
        var word = await db.Words.FirstOrDefaultAsync(w => w.Id == id, ct) ?? throw new KeyNotFoundException();
        var learners = await db.WordProgresses.CountAsync(p => p.WordId == id, ct);
        if (learners > 0) throw new ContentConflictException($"Đã có {learners} người học từ này. Hãy ẩn từ thay vì xoá để giữ tiến độ của họ.");
        db.Words.Remove(word);
        auditor.Record(AuditEntities.Word, id, AuditActions.Delete, word.Text, Auditor.Snapshot(word), null);
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
    }

    public async Task RestoreWordAsync(WordSnapshot s, CancellationToken ct = default)
    {
        var request = new SaveWordRequest(s.DeckId, s.Word, s.Ipa, s.Pos, s.Level, s.MeaningVi, s.Example, s.ExampleVi, s.ImageUrl, s.Published);
        var word = await db.Words.FirstOrDefaultAsync(w => w.Id == s.Id, ct);
        var before = word is null ? null : Auditor.Snapshot(word);
        if (word is null)
        {
            word = new Word { Id = s.Id };
            await ApplyAsync(word, request, ct);
            word.SortOrder = (await db.Words.Select(w => (int?)w.SortOrder).MaxAsync(ct) ?? -1) + 1;
            db.Words.Add(word);
        }
        else
        {
            await ApplyAsync(word, request, ct);
        }
        auditor.Record(AuditEntities.Word, word.Id, AuditActions.Restore, word.Text, before, Auditor.Snapshot(word));
        await db.SaveChangesAsync(ct);
        WordSearchIndex.Invalidate();
    }

    private IQueryable<AdminWordDto> Project(IQueryable<Word> words) =>
        words.Select(w => new AdminWordDto(
            w.Id, w.DeckId, w.Deck.TitleVi, w.Text, w.Ipa, w.Pos, w.Level, w.MeaningVi, w.Example, w.ExampleVi,
            w.ImageUrl, w.SortOrder, w.Published, w.EditedAt,
            db.WordProgresses.Count(p => p.WordId == w.Id),
            w.ImagePending,
            db.MediaFiles.Where(m => m.Url == w.ImageUrl && m.Source != null)
                .Select(m => new ImageCreditDto(m.Source!, m.Author, m.AuthorUrl, m.SourceUrl))
                .FirstOrDefault()));

    /// <summary>
    /// Validates and copies the editable fields. The id is fixed once created (progress references it),
    /// so it may no longer match the word or pos after an edit; uniqueness is enforced on (word, pos) instead.
    /// </summary>
    private async Task ApplyAsync(Word word, SaveWordRequest r, CancellationToken ct)
    {
        var text = Required(r.Word, "Từ", 120);
        var pos = r.Pos?.Trim() ?? "";
        if (!ContentRules.PartsOfSpeech.Contains(pos)) throw new InvalidOperationException("Loại từ không hợp lệ.");
        var level = r.Level?.Trim().ToUpperInvariant() ?? "";
        if (!ContentRules.Levels.Contains(level)) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        if (!await db.Decks.AnyAsync(d => d.Id == r.DeckId, ct)) throw new InvalidOperationException("Bộ từ không tồn tại.");
        var lower = text.ToLower();
        if (await db.Words.AnyAsync(w => w.Id != word.Id && w.Pos == pos && w.Text.ToLower() == lower, ct))
            throw new ContentConflictException($"Đã có từ \"{text}\" với loại từ này. Hãy sửa từ đó thay vì tạo trùng.");

        var image = r.ImageUrl?.Trim();
        if (!string.IsNullOrEmpty(image) && !image.StartsWith(MediaOptions.UrlPrefix + "/") && !Uri.TryCreate(image, UriKind.Absolute, out _))
            throw new InvalidOperationException("Đường dẫn ảnh không hợp lệ.");

        word.Text = text;
        word.Pos = pos;
        word.Level = level;
        word.DeckId = r.DeckId;
        word.Ipa = r.Ipa?.Trim() ?? "";
        word.MeaningVi = Required(r.MeaningVi, "Nghĩa tiếng Việt", 500);
        word.Example = r.Example?.Trim() ?? "";
        word.ExampleVi = r.ExampleVi?.Trim() ?? "";
        var imageUrl = string.IsNullOrEmpty(image) ? null : image;
        if (imageUrl != word.ImageUrl) word.ImagePending = false;
        word.ImageUrl = imageUrl;
        word.Published = r.Published;
        word.EditedAt = DateTimeOffset.UtcNow;
    }

    // ---------- Media ----------

    public async Task<IReadOnlyList<AdminMediaDto>> GetMediaAsync(CancellationToken ct = default) =>
        await db.MediaFiles.AsNoTracking()
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new AdminMediaDto(m.Id, m.Url, m.OriginalName, m.Width, m.Height, m.Bytes, m.CreatedAt,
                db.Words.Count(w => w.ImageUrl == m.Url),
                m.Source == null ? null : new ImageCreditDto(m.Source, m.Author, m.AuthorUrl, m.SourceUrl)))
            .ToListAsync(ct);

    public async Task<AdminMediaDto> UploadMediaAsync(Stream content, string originalName, bool squareCrop, Guid uploadedBy, CancellationToken ct = default)
    {
        var stored = MediaStorage.SaveImage(content, _mediaFolder, squareCrop);
        var media = new MediaFile
        {
            FileName = stored.FileName,
            Url = stored.Url,
            OriginalName = Path.GetFileName(originalName).Length > 255 ? Path.GetFileName(originalName)[..255] : Path.GetFileName(originalName),
            Width = stored.Width,
            Height = stored.Height,
            Bytes = stored.Bytes,
            UploadedBy = uploadedBy,
        };
        db.MediaFiles.Add(media);
        auditor.Record(AuditEntities.Media, media.Id.ToString(), AuditActions.Create, media.OriginalName, null, Auditor.Snapshot(media));
        await db.SaveChangesAsync(ct);
        return new AdminMediaDto(media.Id, media.Url, media.OriginalName, media.Width, media.Height, media.Bytes, media.CreatedAt, 0, null);
    }

    public async Task DeleteMediaAsync(Guid id, CancellationToken ct = default)
    {
        var media = await db.MediaFiles.FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new KeyNotFoundException();
        var used = await db.Words.CountAsync(w => w.ImageUrl == media.Url, ct);
        if (used > 0) throw new ContentConflictException($"Ảnh đang được {used} từ sử dụng.");
        db.MediaFiles.Remove(media);
        auditor.Record(AuditEntities.Media, id.ToString(), AuditActions.Delete, media.OriginalName, Auditor.Snapshot(media), null);
        await db.SaveChangesAsync(ct);
        MediaStorage.Delete(_mediaFolder, media.FileName);
    }

    // ---------- Helpers ----------

    private static string Required(string? value, string label, int max)
    {
        var v = value?.Trim() ?? "";
        if (v.Length == 0) throw new InvalidOperationException($"{label} không được để trống.");
        if (v.Length > max) throw new InvalidOperationException($"{label} dài quá {max} ký tự.");
        return v;
    }

    private static string Icon(string? icon)
    {
        var v = icon?.Trim() ?? "";
        return IconPattern().IsMatch(v) ? v : "albums-outline";
    }

    /// <summary>Same rule as backend/scripts/cefrj.py: lowercase, non-alphanumerics → "-".</summary>
    private static string Slug(string text) => SlugPattern().Replace(text.ToLowerInvariant(), "-").Trim('-');

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex SlugPattern();

    [GeneratedRegex("^[a-z0-9-]{1,64}$")]
    private static partial Regex IconPattern();
}
