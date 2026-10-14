using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Grammar;
using FourUme.Infrastructure.Ai;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Grammar;

/// <summary>Asks the AI which tense every verb phrase of a question is in, so the app can explain it when a word is tapped.</summary>
public sealed partial class GrammarVerbTagger(AiClient ai)
{
    /// <summary>Fixed labels so the app never shows a made-up tense name.</summary>
    public static readonly string[] Tenses =
    [
        "hiện tại đơn", "hiện tại tiếp diễn", "hiện tại hoàn thành", "hiện tại hoàn thành tiếp diễn",
        "quá khứ đơn", "quá khứ tiếp diễn", "quá khứ hoàn thành", "quá khứ hoàn thành tiếp diễn",
        "tương lai đơn", "tương lai gần (be going to)", "tương lai tiếp diễn", "tương lai hoàn thành",
        "bị động – hiện tại đơn", "bị động – quá khứ đơn", "bị động – hiện tại hoàn thành", "bị động – tương lai đơn", "bị động – khác",
        "động từ khuyết thiếu (can, must, should…)", "would (điều kiện / lịch sự)", "used to (thói quen trong quá khứ)", "câu mệnh lệnh",
    ];

    private const int BatchSize = 12;

    private const string Instructions = """
        You are an English teacher labelling verb tenses for Vietnamese learners.
        For each numbered text, list every finite verb phrase (the verb that carries the tense of a clause) with its tense.
        - "phrase": copy the words exactly as written in the text, in order, including auxiliaries and negation
          ("were preparing", "doesn't like", "has never been", "will be", "is going to rain"). Do not include the subject.
          When an adverb sits between the auxiliary and the verb, include it ("has already finished").
        - "tense": one of the allowed labels. Modal verbs (can, could, must, should, may, might) use the modal label;
          "would" uses the would label; passives use a "bị động" label; imperatives ("Open the door") use "câu mệnh lệnh".
        - Skip infinitives (to go), gerunds (swimming is fun), and participles used as adjectives (a broken cup).
        - A text may contain a dialogue written on one line ("Anna: ... Tom: ..."); label every clause.
        """;

    /// <summary>Fills <see cref="GrammarExercise.Verbs"/> in place; questions without English text get an empty list.</summary>
    public async Task TagAsync(IReadOnlyList<GrammarExercise> exercises, CancellationToken ct, string? provider = null)
    {
        if (!ai.Configured) throw new InvalidOperationException(AiClient.NotConfiguredMessage);
        foreach (var batch in exercises.Chunk(BatchSize))
        {
            var texts = batch.Select(AnsweredText).ToList();
            foreach (var (e, i) in batch.Select((e, i) => (e, i)))
                if (string.IsNullOrWhiteSpace(texts[i])) e.Verbs = [];
            if (texts.All(string.IsNullOrWhiteSpace)) continue;

            var prompt = new StringBuilder("Texts:\n");
            for (var i = 0; i < texts.Count; i++)
                if (!string.IsNullOrWhiteSpace(texts[i])) prompt.AppendLine($"{i}: {texts[i]}");

            var reply = await ai.GenerateJsonAsync(Instructions, prompt.ToString(), Schema(), 0, ct, provider);
            var results = JsonSerializer.Deserialize<Reply>(reply.Text, GrammarJson.Options)?.Results ?? [];
            foreach (var r in results.Where(r => r.Index >= 0 && r.Index < batch.Length && !string.IsNullOrWhiteSpace(texts[r.Index])))
            {
                var text = texts[r.Index]!;
                batch[r.Index].Verbs = (r.Verbs ?? [])
                    .Select(v => new GrammarVerbNote { Phrase = WhiteSpace().Replace(v.Phrase.Trim(), " "), TenseVi = v.Tense })
                    .Where(v => v.Phrase.Length > 0 && Tenses.Contains(v.TenseVi) && text.Contains(v.Phrase, StringComparison.OrdinalIgnoreCase))
                    .DistinctBy(v => (v.Phrase.ToLowerInvariant(), v.TenseVi))
                    .ToList();
            }
        }
    }

    /// <summary>The question's English with every gap filled in, i.e. what the learner sees once it is answered.</summary>
    public static string? AnsweredText(GrammarExercise e)
    {
        switch (e.Type)
        {
            case "cloze":
                var i = 0;
                return e.Prompt is null ? null : Gap().Replace(e.Prompt, _ => e.Blanks?.ElementAtOrDefault(i++)?.FirstOrDefault() ?? "___");
            case "fill":
                return e.Prompt is null ? null : Gap().Replace(e.Prompt, e.Answers?.FirstOrDefault() ?? "___", 1);
            case "mcq":
                if (e.Prompt?.Contains("___") == true) return Gap().Replace(e.Prompt, e.Answer ?? "___", 1);
                return e.Answer;
            case "order":
                return e.Answer;
            case "transform":
                return $"{e.Source} {e.Answer}".Trim();
            case "error":
                return e.Sentence is null ? null : Bracket().Replace(e.Sentence, e.Correction ?? "$1", 1);
            default:
                return null;
        }
    }

    private static JsonObject Schema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["results"] = new JsonObject
            {
                ["type"] = "ARRAY",
                ["items"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["index"] = new JsonObject { ["type"] = "INTEGER" },
                        ["verbs"] = new JsonObject
                        {
                            ["type"] = "ARRAY",
                            ["items"] = new JsonObject
                            {
                                ["type"] = "OBJECT",
                                ["properties"] = new JsonObject
                                {
                                    ["phrase"] = Str(),
                                    ["tense"] = new JsonObject { ["type"] = "STRING", ["enum"] = new JsonArray(Tenses.Select(t => (JsonNode)t).ToArray()) },
                                },
                                ["required"] = Names("phrase", "tense"),
                            },
                        },
                    },
                    ["required"] = Names("index", "verbs"),
                },
            },
        },
        ["required"] = Names("results"),
    };

    private sealed class Reply
    {
        public List<Result> Results { get; set; } = [];
    }

    private sealed class Result
    {
        public int Index { get; set; }
        public List<Verb>? Verbs { get; set; }
    }

    private sealed class Verb
    {
        public string Phrase { get; set; } = "";
        public string Tense { get; set; } = "";
    }

    /// <summary>A gap with its optional "(be)" hint.</summary>
    [GeneratedRegex(@"_{3,}(\s*\([^)]*\))?")]
    private static partial Regex Gap();

    [GeneratedRegex(@"\[([^\]]*)\]")]
    private static partial Regex Bracket();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();
}
