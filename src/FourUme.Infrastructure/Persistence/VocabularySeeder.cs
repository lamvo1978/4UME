using System.Text.Json;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Persistence;

public static class VocabularySeeder
{
    private sealed class VocabFile
    {
        public List<DeckFile> Decks { get; set; } = [];
    }

    private sealed class DeckFile
    {
        public string Id { get; set; } = "";
        public string TitleVi { get; set; } = "";
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
    }

    public static async Task SeedAsync(AppDbContext db, string vocabularyPath, ILogger logger, CancellationToken ct = default)
    {
        if (await db.Words.AnyAsync(ct))
        {
            logger.LogInformation("Vocabulary already seeded ({Count} words).", await db.Words.CountAsync(ct));
            return;
        }

        if (!File.Exists(vocabularyPath))
        {
            throw new FileNotFoundException($"Vocabulary file not found: {vocabularyPath}");
        }

        await using var stream = File.OpenRead(vocabularyPath);
        var data = await JsonSerializer.DeserializeAsync<VocabFile>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }, ct) ?? throw new InvalidOperationException("Invalid vocabulary.json");

        var words = new List<Word>();
        foreach (var deck in data.Decks)
        {
            foreach (var w in deck.Words)
            {
                words.Add(new Word
                {
                    Id = w.Id,
                    DeckId = deck.Id,
                    DeckTitleVi = deck.TitleVi,
                    Text = w.Word,
                    Ipa = w.Ipa,
                    Pos = w.Pos,
                    Level = w.Level,
                    MeaningVi = w.MeaningVi,
                    Example = w.Example,
                    ExampleVi = w.ExampleVi
                });
            }
        }

        const int batch = 500;
        for (var i = 0; i < words.Count; i += batch)
        {
            db.Words.AddRange(words.Skip(i).Take(batch));
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }

        logger.LogInformation("Seeded {Count} vocabulary words from {Path}.", words.Count, vocabularyPath);
    }
}
