using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Ai;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Listening;

/// <summary>
/// Writes a first draft of a listening piece with Google Gemini. The reply is forced into the lesson's JSON shape;
/// nothing is saved here, the admin reviews the draft in the editor.
/// </summary>
public sealed partial class GeminiDraftService(
    AppDbContext db,
    GeminiClient gemini,
    ILogger<GeminiDraftService> logger) : IListeningDraftService
{
    private static readonly Dictionary<string, (string Lines, string Words)> Lengths = new()
    {
        ["short"] = ("8–12", "100–150"),
        ["medium"] = ("12–18", "150–250"),
        ["long"] = ("18–26", "250–400"),
    };

    private static readonly Dictionary<string, string> LevelGuide = new()
    {
        ["A1"] = "A1: very common words only, short sentences (5–10 words), present simple and 'can', everyday situations.",
        ["A2"] = "A2: common words, short sentences (8–14 words), past simple, 'going to', simple linking words (and, but, because).",
        ["B1"] = "B1: everyday and some topic words, mixed tenses incl. present perfect, a few longer sentences, natural phrasal verbs.",
        ["B2"] = "B2: richer vocabulary and idioms used naturally, complex sentences, opinions and reasons, still clear for learners.",
    };

    private const string Instructions = """
        You write listening pieces for 4UME, an English-learning app for Vietnamese adults.

        Purpose: relaxed listening practice to get used to natural spoken English. There are no questions, quizzes or scores.
        Learners listen, may read the English script, and may read the Vietnamese translation under each sentence.
        The audio is produced later by text-to-speech, one sentence (line) at a time, so every line must read well aloud.

        Rules:
        - Match the requested CEFR level strictly (vocabulary, grammar, sentence length). Never go above it.
        - Kinds:
          - dialogue: a natural everyday conversation between 2 (at most 3) people. Speakers take turns; a line is what one person says in one turn (1–3 short sentences).
          - story: a short story told by one narrator, with a clear beginning, middle and end; warm and easy to follow.
          - news: a short, calm news-style report written from scratch about a general topic (weather, city life, health, science, technology, environment, sport, culture).
            Use invented but realistic places and people; never copy or imitate real news articles; no politics, no tragedies, no real brands or celebrities.
        - Content must be friendly, positive or neutral, and suitable for all ages. Show everyday life that Vietnamese learners can relate to; international settings are fine.
        - English: natural, idiomatic for the level, correct punctuation, no markdown, no stage directions, no sound effects, no emojis.
          In dialogues and stories use contractions the way people really speak (I'm, it's, don't, can't, I'd like), at every level; news may be slightly more formal.
          Write numbers, times and prices the way they should be spoken when that helps TTS (e.g. "seven thirty", "twelve dollars").
        - Each line has "en" (English, at most 300 characters) and "vi" (natural Vietnamese translation of that line, not word-for-word;
          keep English names; use polite, everyday Vietnamese).
        - titleEn: short English title in Title Case. titleVi: natural Vietnamese title. summaryVi: 1–2 Vietnamese sentences describing the situation, without spoilers.
        - topic: a short Vietnamese topic label (e.g. "Mua sắm", "Du lịch", "Sức khoẻ").
        - Speakers: key = lowercase short id (letters/digits, e.g. "anna", "narrator"); name = the display name (for story/news use "Narrator" or "Reporter").
          Pick a voice from the allowed list that matches each speaker's gender; use different voices for different speakers.
          Prefer en-US voices; mix in en-GB or en-AU only when it fits the characters.
        - Do not reuse the titles or situations of the existing lessons listed in the request.
        """;

    public ListeningDraftStatusDto GetStatus() => new(gemini.Configured, gemini.ModelName);

    public async Task<ListeningDraftDto> DraftAsync(ListeningDraftRequest request, CancellationToken ct = default)
    {
        if (!gemini.Configured) throw new InvalidOperationException("Chưa cấu hình Gemini (GEMINI_API_KEY) trên máy chủ.");
        var level = request.Level.Trim().ToUpperInvariant();
        var kind = request.Kind.Trim();
        if (!LevelGuide.ContainsKey(level)) throw new InvalidOperationException($"Cấp độ không hợp lệ: {request.Level}.");
        if (!ListeningKinds.All.Contains(kind)) throw new InvalidOperationException($"Thể loại không hợp lệ: {request.Kind}.");
        var length = Lengths.TryGetValue(request.Length ?? "", out var l) ? l : Lengths["medium"];

        var existing = await db.ListeningLessons.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new { x.Slug, x.TitleEn, x.Kind, x.Level, x.SortOrder })
            .ToListAsync(ct);
        var exampleSlug = existing.FirstOrDefault(x => x.Kind == kind && x.Level == level)?.Slug
            ?? existing.FirstOrDefault(x => x.Kind == kind)?.Slug;
        var example = exampleSlug is null ? null : await db.ListeningLessons.AsNoTracking().FirstAsync(x => x.Slug == exampleSlug, ct);

        var prompt = new StringBuilder();
        prompt.AppendLine($"Write one {kind} at level {level}.");
        prompt.AppendLine(LevelGuide[level]);
        prompt.AppendLine($"Length: {length.Lines} lines, about {length.Words} English words in total.");
        if (!string.IsNullOrWhiteSpace(request.Topic)) prompt.AppendLine($"Topic / situation: {request.Topic.Trim()}");
        if (!string.IsNullOrWhiteSpace(request.Notes)) prompt.AppendLine($"Extra wishes from the editor (may be in Vietnamese): {request.Notes.Trim()}");
        prompt.AppendLine();
        prompt.AppendLine("Allowed voices (name — accent, gender):");
        foreach (var v in ListeningRules.Voices) prompt.AppendLine($"- {v.Name} — {v.Accent}, {v.Gender}");
        if (existing.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("Existing lessons (do not repeat them):");
            foreach (var x in existing) prompt.AppendLine($"- {x.Level} {x.Kind}: {x.TitleEn}");
        }
        if (example is not null)
        {
            var doc = ListeningRules.ToDocument(example);
            prompt.AppendLine();
            prompt.AppendLine("Example of the style and format (an existing lesson, do not copy its content):");
            prompt.AppendLine(JsonSerializer.Serialize(new { doc.TitleEn, doc.TitleVi, doc.Topic, doc.SummaryVi, doc.Speakers, Lines = doc.Lines.Take(6) }, GrammarJson.Options));
        }

        var reply = await gemini.GenerateJsonAsync(Instructions, prompt.ToString(), Schema(), 0.9, ct);
        ListeningLessonDocument draft;
        try
        {
            draft = JsonSerializer.Deserialize<ListeningLessonDocument>(reply, GrammarJson.Options)
                ?? throw new JsonException("empty");
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Gemini returned invalid JSON");
            throw new InvalidOperationException("Gemini trả về dữ liệu không đúng khuôn, hãy bấm viết lại.");
        }

        draft.Kind = kind;
        draft.Level = level;
        draft.Version = 1;
        draft.Published = false;
        draft.Order = existing.Count == 0 ? 1 : existing.Max(x => x.SortOrder) + 1;
        draft.Slug = UniqueSlug(Slugify(draft.TitleEn), existing.Select(x => x.Slug).ToHashSet());
        draft = ListeningRules.Normalize(draft);
        return new ListeningDraftDto(draft, ListeningRules.Validate(draft));
    }

    private static JsonObject Schema()
    {
        return new JsonObject
        {
            ["type"] = "OBJECT",
            ["properties"] = new JsonObject
            {
                ["titleEn"] = Str(),
                ["titleVi"] = Str(),
                ["topic"] = Str(),
                ["summaryVi"] = Str(),
                ["speakers"] = new JsonObject
                {
                    ["type"] = "ARRAY",
                    ["items"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["key"] = Str("lowercase id, letters and digits only"),
                            ["name"] = Str(),
                            ["voice"] = new JsonObject
                            {
                                ["type"] = "STRING",
                                ["enum"] = new JsonArray(ListeningRules.Voices.Select(v => (JsonNode)v.Name).ToArray()),
                            },
                        },
                        ["required"] = Names("key", "name", "voice"),
                    },
                },
                ["lines"] = new JsonObject
                {
                    ["type"] = "ARRAY",
                    ["items"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["speaker"] = Str("key of one of the speakers"),
                            ["en"] = Str(),
                            ["vi"] = Str(),
                        },
                        ["required"] = Names("speaker", "en", "vi"),
                    },
                },
            },
            ["required"] = Names("titleEn", "titleVi", "topic", "summaryVi", "speakers", "lines"),
        };
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlug();

    private static string Slugify(string title)
    {
        var plain = new string(title.Normalize(NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .ToArray()).ToLowerInvariant();
        var slug = NonSlug().Replace(plain, "-").Trim('-');
        return slug.Length == 0 ? "bai-moi" : slug[..Math.Min(slug.Length, 70)].Trim('-');
    }

    private static string UniqueSlug(string slug, HashSet<string> taken)
    {
        if (!taken.Contains(slug)) return slug;
        for (var i = 2; ; i++)
            if (!taken.Contains($"{slug}-{i}")) return $"{slug}-{i}";
    }
}
