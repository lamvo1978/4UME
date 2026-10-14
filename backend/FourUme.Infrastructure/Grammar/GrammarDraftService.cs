using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Infrastructure.Ai;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Grammar;

/// <summary>
/// Drafts grammar questions for one lesson with the AI, then asks it again to check every answer.
/// Nothing is saved; the admin picks which questions to add to the lesson.
/// </summary>
public sealed partial class GrammarDraftService(AiClient ai, GrammarVerbTagger verbs, ILogger<GrammarDraftService> logger) : IGrammarDraftService
{
    private static readonly Dictionary<string, string> TypeGuide = new()
    {
        ["mcq"] = """
            mcq: "prompt" (a sentence with ___ for the gap, or an instruction such as "Chọn câu đúng." when the options are whole sentences),
            "options" (3 or 4 distinct, plausible options), "answer" (exactly one of the options). Only one option may be correct.
            """,
        ["fill"] = """
            fill: "prompt" with exactly one ___ and, right after it, the base word in brackets whenever more than one form could fit,
            e.g. "She ___ (go) to school every day."; "answers" = every correct way to write it (include contractions like "doesn't" and "does not").
            """,
        ["order"] = """
            order: "promptVi" (a natural Vietnamese sentence), "answer" (its English translation, 4–12 words, with final punctuation),
            "distractors" (1–2 extra wrong words that test the grammar point, e.g. the wrong verb form). The learner builds "answer" from its words.
            """,
        ["transform"] = """
            transform: "instructionVi" (e.g. "Chuyển sang câu phủ định", "Chuyển sang câu hỏi", "Viết lại dùng thì quá khứ đơn"),
            "source" (the original sentence), "answer" (the rewritten sentence), "distractors" (1–2 wrong words). Only one correct rewrite may exist.
            """,
        ["error"] = """
            error: "sentence" MUST contain a real grammar mistake: write a correct sentence, then replace one word or short phrase with a typical
            learner mistake and put ONLY that wrong part in square brackets. "correction" is the right form, which must differ from the bracketed text.
            Example: {"sentence": "She [go] to school every day.", "correction": "goes"}. Never output a sentence without a mistake or without brackets.
            """,
        ["cloze"] = """
            cloze: "prompt" is ONE connected text of 40–90 words (a message, diary entry, short story, or a dialogue written on one line as
            "Anna: ... Tom: ..."), with 3–6 gaps ___, each followed by the base word in brackets when needed. "blanks" = one list per gap, in order,
            with every accepted answer (include contractions). Every gap must test the lesson's grammar point.
            Example: {"prompt": "Hi Mai! I ___ (be) in Da Lat with my family. The weather ___ (be) cool and the people ___ (be) very friendly. My room
            is small but it ___ (be) clean. Where ___ (be) you now? Write soon!", "blanks": [["am"], ["is"], ["are"], ["is"], ["are"]]}
            Short sentences or 1–2 line texts are NOT acceptable. The words around a gap must not already contain its answer
            (wrong: "Are you ___ (be) ready?" — "Are" is already written; right: "___ (be) you ready?").
            """,
    };

    private static readonly Dictionary<string, string> DifficultyGuide = new()
    {
        ["easy"] = "Difficulty: easy — short, clear sentences; test the basic form only.",
        ["mixed"] = "Difficulty: mixed — about one third easy, one third medium, one third harder (negatives, questions, exceptions, signal words, contrast with similar structures).",
        ["hard"] = "Difficulty: harder — trickier choices with the SAME forms the lesson teaches: tricky subjects (e.g. \"My sister and I\", \"Everyone\", plural nouns, names), negatives and questions, several forms mixed in one text, longer sentences. Harder NEVER means adding grammar the lesson does not teach (no -ing forms, past, future, passive or other tenses unless the lesson teaches them).",
    };

    private const string Instructions = """
        You write grammar exercises for 4UME, an English-learning app for Vietnamese adults.

        Rules:
        - Test ONLY the grammar point of the given lesson (you may contrast it with easier structures the learner already knows).
          Use only the forms taught in the lesson's theory: e.g. a lesson on am/is/are must not ask for was/were, -ing forms (am/is/are + V-ing), passives or other tenses.
        - Vocabulary and sentence length must match the lesson's CEFR level; never go above it.
        - English must be natural, correct and unambiguous: exactly one correct answer (or every correct variant listed).
        - Use everyday situations Vietnamese learners relate to; friendly content suitable for all ages; no brands, politics or celebrities.
        - Vary subjects, situations and sentence patterns; never repeat or lightly reword the existing questions given in the request.
        - "explanationVi": 1–2 short Vietnamese sentences explaining WHY the answer is right (the rule), not just repeating the answer.
        - Every field must be present: fill ALL fields the question type uses (never skip options/answer/answers/blanks),
          and give "" or [] for the fields it does not use. No markdown, no numbering inside prompts.
        """;

    private const string CheckInstructions = """
        You are a strict English teacher checking grammar exercises written for Vietnamese learners.
        For each exercise decide whether it is correct and usable:
        - the given answer is grammatically correct and natural;
        - no other option / answer would also be correct (for mcq and error) unless it is listed as accepted (for fill and cloze);
        - for error: the bracketed part is really wrong and the correction fixes it, and nothing else in the sentence is wrong;
        - for order/transform: the answer is the only natural sentence that can be built;
        - for cloze: the text is natural and connected, and every gap has exactly the answers listed;
        - the exercise tests the lesson's grammar point with forms the lesson teaches (not other tenses or structures):
          check EVERY sentence of a cloze text, not only the gaps — e.g. a lesson on am/is/are must not contain "is staying" or "are coming".
          The lesson's own forms used in other ordinary ways are fine (e.g. "he is still strong", "it is not hot" in an am/is/are lesson);
          only flag a form the lesson does not teach, and do not flag simple A1 words just for being outside the gaps;
        - filling every gap with its answer gives a correct sentence (no doubled words like "Are you are ready");
        - the Vietnamese (promptVi, instructionVi, explanationVi) is correct and matches.
        Reply "ok": true when it is fine. Otherwise "ok": false and "problemVi": one short Vietnamese sentence saying what is wrong.
        """;

    public async Task<GrammarDraftDto> DraftAsync(GrammarDraftRequest request, CancellationToken ct = default)
    {
        if (!ai.Configured) throw new InvalidOperationException(AiClient.NotConfiguredMessage);
        var lesson = request.Lesson ?? throw new InvalidOperationException("Thiếu nội dung bài.");
        if (string.IsNullOrWhiteSpace(lesson.TitleVi) && string.IsNullOrWhiteSpace(lesson.TitleEn))
            throw new InvalidOperationException("Bài chưa có tên, AI không biết soạn về chủ điểm nào.");

        var allowed = request.Target == GrammarDraftRules.TargetPractice ? GrammarValidator.PracticeTypes : GrammarValidator.ExerciseTypes;
        var types = (request.Types ?? []).Where(allowed.Contains).Distinct().ToList();
        if (types.Count == 0) types = [.. allowed];
        var count = Math.Clamp(request.Count, 1, GrammarDraftRules.MaxCount);
        var difficulty = GrammarDraftRules.Difficulties.Contains(request.Difficulty) ? request.Difficulty! : "mixed";

        var existing = lesson.Exercises.Concat(lesson.Practice ?? []).ToList();
        var prompt = new StringBuilder();
        prompt.AppendLine($"Lesson: {lesson.TitleEn} / {lesson.TitleVi} (level {lesson.Level}).");
        if (!string.IsNullOrWhiteSpace(lesson.SummaryVi)) prompt.AppendLine($"Summary (Vietnamese): {lesson.SummaryVi}");
        if (lesson.Sections.Count > 0)
        {
            prompt.AppendLine("Theory taught in the lesson (JSON):");
            prompt.AppendLine(JsonSerializer.Serialize(lesson.Sections, GrammarJson.Options));
        }
        prompt.AppendLine();
        prompt.AppendLine($"Write {count} new exercises. Spread them evenly over these types: {string.Join(", ", types)}.");
        prompt.AppendLine(DifficultyGuide[difficulty]);
        prompt.AppendLine("Formats:");
        foreach (var t in types) prompt.AppendLine("- " + TypeGuide[t].ReplaceLineEndings(" ").Trim());
        if (!string.IsNullOrWhiteSpace(request.Notes)) prompt.AppendLine($"Extra wishes from the editor (may be in Vietnamese): {request.Notes.Trim()}");
        if (existing.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("Existing questions (do not repeat them):");
            foreach (var e in existing) prompt.AppendLine("- " + Summary(e));
        }

        var reply = await ai.GenerateJsonAsync(Instructions, prompt.ToString(), DraftSchema(types), 0.8, ct, request.Provider);
        List<GrammarExercise> drafted;
        try
        {
            drafted = JsonSerializer.Deserialize<DraftReply>(reply.Text, GrammarJson.Options)?.Exercises ?? [];
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "AI returned invalid grammar JSON");
            throw new InvalidOperationException("AI trả về dữ liệu không đúng khuôn, hãy bấm soạn lại.");
        }
        drafted = drafted.Where(e => types.Contains(e.Type)).Select(Normalize).Take(count).ToList();
        if (drafted.Count == 0) throw new InvalidOperationException("AI không soạn được câu nào, hãy thử lại.");

        AssignIds(drafted, existing, lesson.Slug);

        var (warnings, isChecked) = request.SkipCheck ? ([], false) : await CheckAsync(lesson, drafted, request.Provider, ct);
        try
        {
            await verbs.TagAsync(drafted, ct, request.Provider);
        }
        catch (Exception ex) when (ex is InvalidOperationException or JsonException or HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            // Untagged questions are picked up later by "Gắn thì động từ".
            logger.LogWarning(ex, "Grammar draft verb tagging failed");
        }
        var ids = existing.Select(e => e.Id).ToHashSet();
        var items = drafted.Select((e, i) =>
        {
            var problems = new List<string>();
            GrammarValidator.ValidateItem(e, ids, problems);
            var prefix = $"Bài tập {e.Id}: ";
            problems = problems.Select(p => p.StartsWith(prefix) ? p[prefix.Length..] : p).ToList();
            problems.AddRange(DraftProblems(e));
            return new GrammarDraftItemDto(e, problems, warnings.GetValueOrDefault(i));
        }).ToList();
        return new GrammarDraftDto(items, isChecked, reply.Model);
    }

    /// <summary>Second pass; a failure here only means the admin gets no warnings, the draft is still returned.</summary>
    private async Task<(Dictionary<int, string> Warnings, bool Checked)> CheckAsync(GrammarLessonDocument lesson, List<GrammarExercise> drafted, string? provider, CancellationToken ct)
    {
        var prompt = new StringBuilder();
        prompt.AppendLine($"Lesson: {lesson.TitleEn} / {lesson.TitleVi} (level {lesson.Level}).");
        if (!string.IsNullOrWhiteSpace(lesson.SummaryVi)) prompt.AppendLine($"What the lesson teaches (Vietnamese): {lesson.SummaryVi}");
        prompt.AppendLine("Exercises (JSON, check each one by its index):");
        prompt.AppendLine(JsonSerializer.Serialize(drafted.Select((e, i) => new { index = i, exercise = WithoutId(e) }), GrammarJson.Options));
        try
        {
            var reply = await ai.GenerateJsonAsync(CheckInstructions, prompt.ToString(), CheckSchema(), 0, ct, provider);
            var results = JsonSerializer.Deserialize<CheckReply>(reply.Text, GrammarJson.Options)?.Results ?? [];
            return (results
                .Where(r => !r.Ok && r.Index >= 0 && r.Index < drafted.Count)
                .GroupBy(r => r.Index)
                .ToDictionary(g => g.Key, g => string.IsNullOrWhiteSpace(g.First().ProblemVi) ? "AI nghi câu này có vấn đề." : g.First().ProblemVi!.Trim()), true);
        }
        catch (Exception ex) when (ex is InvalidOperationException or JsonException or HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Grammar draft check failed");
            return ([], false);
        }

        static object WithoutId(GrammarExercise e) => new
        {
            e.Type, e.Prompt, e.PromptVi, e.InstructionVi, e.Source, e.Sentence, e.Options, e.Answer, e.Answers, e.Blanks, e.Distractors, e.Correction, e.ExplanationVi,
        };
    }

    /// <summary>Stricter than the shared validator: catches the ways models misread the formats, without limiting what editors write by hand.</summary>
    private static IEnumerable<string> DraftProblems(GrammarExercise e)
    {
        if (e.Type == "cloze" && e.Prompt is not null)
        {
            var words = e.Prompt.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
            if (words < MinClozeWords) yield return $"Đoạn văn quá ngắn ({words} từ), nên có khoảng 40–90 từ.";
        }
        if (e.Type is "cloze" or "fill" && e.Prompt is not null)
        {
            var answers = e.Type == "cloze" ? e.Blanks ?? [] : [e.Answers ?? []];
            foreach (var problem in DoubledAnswers(e.Prompt, answers)) yield return problem;
        }
        if (e.Type == "error" && e.Sentence is not null && e.Correction is not null)
        {
            var open = e.Sentence.IndexOf('[');
            var close = e.Sentence.IndexOf(']');
            if (open >= 0 && close > open && string.Equals(e.Sentence[(open + 1)..close].Trim(), e.Correction.Trim(), StringComparison.OrdinalIgnoreCase))
                yield return "Phần trong ngoặc giống hệt từ sửa, câu không có lỗi.";
        }
    }

    private const int MinClozeWords = 25;

    /// <summary>Flags a gap whose answer is already written right next to it, e.g. "Are you ___ (be) ready?" with "are".</summary>
    private static IEnumerable<string> DoubledAnswers(string prompt, List<List<string>> answers)
    {
        var parts = prompt.Split("___");
        for (var i = 0; i < parts.Length - 1 && i < answers.Count; i++)
        {
            var before = WordPattern().Matches(parts[i]).Select(m => m.Value).TakeLast(2);
            var after = WordPattern().Matches(HintPattern().Replace(parts[i + 1], "", 1)).Select(m => m.Value).Take(1);
            var near = before.Concat(after).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var doubled = answers[i].FirstOrDefault(a => !a.Contains(' ') && near.Contains(a.Trim()));
            if (doubled is not null)
                yield return answers.Count > 1
                    ? $"Chỗ trống {i + 1}: từ \"{doubled}\" đã có sẵn ngay cạnh, điền vào sẽ bị lặp."
                    : $"Từ \"{doubled}\" đã có sẵn ngay cạnh chỗ trống, điền vào sẽ bị lặp.";
        }
    }

    private static string Summary(GrammarExercise e) => e.Type switch
    {
        "order" => $"order: {e.Answer}",
        "transform" => $"transform: {e.Source} → {e.Answer}",
        "error" => $"error: {e.Sentence}",
        _ => $"{e.Type}: {e.Prompt}",
    };

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : WhiteSpace().Replace(s.Trim(), " ");

    private static List<string>? CleanList(List<string>? list)
    {
        var cleaned = list?.Select(Clean).OfType<string>().Distinct().ToList();
        return cleaned is { Count: > 0 } ? cleaned : null;
    }

    /// <summary>Keeps only the fields the type uses and tidies whitespace, so the editor shows a clean question.</summary>
    private static GrammarExercise Normalize(GrammarExercise e)
    {
        var n = new GrammarExercise { Type = e.Type, ExplanationVi = Clean(e.ExplanationVi) ?? "" };
        switch (e.Type)
        {
            case "mcq":
                n.Prompt = Clean(e.Prompt);
                n.Options = CleanList(e.Options);
                n.Answer = Clean(e.Answer);
                break;
            case "fill":
                n.Prompt = Clean(e.Prompt);
                n.Answers = CleanList(e.Answers);
                break;
            case "order":
                n.PromptVi = Clean(e.PromptVi);
                n.Answer = Clean(e.Answer);
                n.Distractors = CleanList(e.Distractors);
                break;
            case "transform":
                n.InstructionVi = Clean(e.InstructionVi);
                n.Source = Clean(e.Source);
                n.Answer = Clean(e.Answer);
                n.Distractors = CleanList(e.Distractors);
                break;
            case "error":
                n.Sentence = Clean(e.Sentence);
                n.Correction = Clean(e.Correction);
                break;
            case "cloze":
                n.Prompt = Clean(e.Prompt);
                n.Blanks = e.Blanks?.Select(b => CleanList(b) ?? []).ToList();
                break;
        }
        return n;
    }

    /// <summary>Continues the lesson's own id pattern ("pc-14" → "pc-15"), same as the admin editor.</summary>
    private static void AssignIds(List<GrammarExercise> drafted, List<GrammarExercise> existing, string slug)
    {
        var prefix = existing.Select(e => IdPattern().Match(e.Id)).FirstOrDefault(m => m.Success)?.Groups[1].Value;
        if (string.IsNullOrEmpty(prefix))
        {
            var initials = string.Concat(slug.Split('-', StringSplitOptions.RemoveEmptyEntries).Select(p => p[0]));
            prefix = (initials.Length > 0 ? initials[..Math.Min(3, initials.Length)] : "ex") + "-";
        }
        var max = existing.Select(e => IdPattern().Match(e.Id)).Where(m => m.Success).Select(m => int.Parse(m.Groups[2].Value)).DefaultIfEmpty(0).Max();
        foreach (var e in drafted) e.Id = $"{prefix}{++max:00}";
    }

    private static JsonObject DraftSchema(IReadOnlyList<string> types)
    {
        var strings = new JsonObject { ["type"] = "ARRAY", ["items"] = Str() };
        return new JsonObject
        {
            ["type"] = "OBJECT",
            ["properties"] = new JsonObject
            {
                ["exercises"] = new JsonObject
                {
                    ["type"] = "ARRAY",
                    ["items"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["type"] = new JsonObject { ["type"] = "STRING", ["enum"] = new JsonArray(types.Select(t => (JsonNode)t).ToArray()) },
                            ["prompt"] = Str(),
                            ["promptVi"] = Str(),
                            ["instructionVi"] = Str(),
                            ["source"] = Str(),
                            ["sentence"] = Str(),
                            ["options"] = strings.DeepClone(),
                            ["answer"] = Str(),
                            ["answers"] = strings.DeepClone(),
                            ["blanks"] = new JsonObject { ["type"] = "ARRAY", ["items"] = strings.DeepClone() },
                            ["distractors"] = strings.DeepClone(),
                            ["correction"] = Str(),
                            ["explanationVi"] = Str(),
                        },
                        // Every field is required: with optional fields the AI sometimes drops the ones that matter (e.g. mcq options).
                        // Fields the type doesn't use come back empty and Normalize drops them.
                        ["required"] = Names("type", "prompt", "promptVi", "instructionVi", "source", "sentence", "options", "answer",
                            "answers", "blanks", "distractors", "correction", "explanationVi"),
                    },
                },
            },
            ["required"] = Names("exercises"),
        };
    }

    private static JsonObject CheckSchema() => new()
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
                        ["ok"] = new JsonObject { ["type"] = "BOOLEAN" },
                        ["problemVi"] = Str(),
                    },
                    ["required"] = Names("index", "ok"),
                },
            },
        },
        ["required"] = Names("results"),
    };

    private sealed class DraftReply
    {
        public List<GrammarExercise> Exercises { get; set; } = [];
    }

    private sealed class CheckReply
    {
        public List<CheckResult> Results { get; set; } = [];
    }

    private sealed class CheckResult
    {
        public int Index { get; set; }
        public bool Ok { get; set; }
        public string? ProblemVi { get; set; }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();

    [GeneratedRegex(@"^(.*?)(\d+)$")]
    private static partial Regex IdPattern();

    [GeneratedRegex(@"[A-Za-z']+")]
    private static partial Regex WordPattern();

    /// <summary>The "(be)" hint right after a gap.</summary>
    [GeneratedRegex(@"^\s*\([^)]*\)")]
    private static partial Regex HintPattern();
}
