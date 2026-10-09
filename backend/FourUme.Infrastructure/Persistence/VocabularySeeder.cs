using System.Text.Json;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Persistence;

public static class VocabularySeeder
{
    /// <summary>AppSettings key holding the vocabulary.json version last applied to the database.</summary>
    private const string VersionKey = "vocabulary.version";

    private sealed class VocabFile
    {
        public int Version { get; set; }
        public List<DeckFile> Decks { get; set; } = [];
    }

    private sealed class DeckFile
    {
        public string Id { get; set; } = "";
        public string TitleVi { get; set; } = "";
        public string? Icon { get; set; }
        public List<WordFile> Words { get; set; } = [];
    }

    private sealed class WordFile
    {
        public string Id { get; set; } = "";
        public string Word { get; set; } = "";
        public string Ipa { get; set; } = "";
        public string Pos { get; set; } = "";
        public string Level { get; set; } = "";
        public string MeaningVi { get; set; } = "";
        public string Example { get; set; } = "";
        public string ExampleVi { get; set; } = "";
        public string? ImageUrl { get; set; }
    }

    public static async Task SeedAsync(AppDbContext db, string vocabularyPath, ILogger logger, CancellationToken ct = default)
    {
        if (!File.Exists(vocabularyPath))
        {
            throw new FileNotFoundException($"Vocabulary file not found: {vocabularyPath}");
        }

        await using var stream = File.OpenRead(vocabularyPath);
        var data = await JsonSerializer.DeserializeAsync<VocabFile>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }, ct) ?? throw new InvalidOperationException("Invalid vocabulary.json");

        await SyncDecksAsync(db, data, ct);

        var setting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == VersionKey, ct);
        var applied = int.TryParse(setting?.Value, out var v) ? v : 0;
        var seeded = await db.Words.AnyAsync(ct);

        if (seeded && data.Version <= applied)
        {
            await SyncMetadataAsync(db, data, logger, ct);
            logger.LogInformation("Vocabulary up to date ({Count} words, version {Version}).", await db.Words.CountAsync(ct), applied);
            return;
        }

        // A newer file updates word content, except words edited in the admin (the database is the source of truth).
        var existing = await db.Words.ToDictionaryAsync(w => w.Id, ct);
        var inserted = 0;
        var updated = 0;
        var order = 0;
        foreach (var deck in data.Decks)
        {
            foreach (var w in deck.Words)
            {
                if (!existing.TryGetValue(w.Id, out var word))
                {
                    word = new Word { Id = w.Id };
                    db.Words.Add(word);
                    existing[w.Id] = word;
                    inserted++;
                }
                else if (word.EditedAt is not null)
                {
                    order++;
                    continue;
                }
                else
                {
                    updated++;
                }
                word.DeckId = deck.Id;
                word.Text = w.Word;
                word.Ipa = w.Ipa;
                word.Pos = w.Pos;
                word.Level = w.Level;
                word.MeaningVi = w.MeaningVi;
                word.Example = w.Example;
                word.ExampleVi = w.ExampleVi;
                word.ImageUrl = NormalizeUrl(w.ImageUrl);
                word.SortOrder = order++;
            }
        }

        if (setting is null)
        {
            setting = new AppSetting { Key = VersionKey };
            db.AppSettings.Add(setting);
        }
        setting.Value = data.Version.ToString();
        setting.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
        logger.LogInformation("Vocabulary version {Version}: {Inserted} inserted, {Updated} updated.", data.Version, inserted, updated);
    }

    /// <summary>Keeps image URLs and study order in sync with the JSON file without reseeding.</summary>
    private static async Task SyncMetadataAsync(AppDbContext db, VocabFile data, ILogger logger, CancellationToken ct)
    {
        var fromFile = new Dictionary<string, (string? ImageUrl, int Order)>();
        var order = 0;
        foreach (var w in data.Decks.SelectMany(d => d.Words))
        {
            fromFile.TryAdd(w.Id, (NormalizeUrl(w.ImageUrl), order));
            order++;
        }

        var words = await db.Words.ToListAsync(ct);
        var changed = 0;
        foreach (var word in words)
        {
            if (word.EditedAt is not null || !fromFile.TryGetValue(word.Id, out var meta)) continue;
            if (word.ImageUrl == meta.ImageUrl && word.SortOrder == meta.Order) continue;
            word.ImageUrl = meta.ImageUrl;
            word.SortOrder = meta.Order;
            changed++;
        }

        if (changed > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Synced image URLs / study order for {Count} words.", changed);
        }
        db.ChangeTracker.Clear();
    }

    /// <summary>Adds decks missing from the database and refreshes ones never edited in the admin.</summary>
    private static async Task SyncDecksAsync(AppDbContext db, VocabFile data, CancellationToken ct)
    {
        var existing = await db.Decks.ToDictionaryAsync(d => d.Id, ct);
        for (var i = 0; i < data.Decks.Count; i++)
        {
            var file = data.Decks[i];
            if (!existing.TryGetValue(file.Id, out var deck))
            {
                deck = new Deck { Id = file.Id };
                db.Decks.Add(deck);
            }
            else if (deck.EditedAt is not null)
            {
                continue;
            }
            deck.TitleVi = file.TitleVi;
            deck.Icon = string.IsNullOrWhiteSpace(file.Icon) ? "albums-outline" : file.Icon;
            deck.SortOrder = i;
        }
        await db.SaveChangesAsync(ct);
    }

    private static string? NormalizeUrl(string? url) => string.IsNullOrWhiteSpace(url) ? null : url.Trim();
}
