using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Grammar;
using FourUme.Application.Placement;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Admin;

public sealed partial class AdminPlacementService(
    IAppDbContext db,
    Auditor auditor,
    GeminiClient gemini,
    ILogger<AdminPlacementService> logger) : IAdminPlacementService
{
    public async Task<IReadOnlyList<AdminPlacementGrammarDto>> GetGrammarAsync(CancellationToken ct = default)
    {
        var rows = await db.PlacementGrammarQuestions.AsNoTracking().OrderBy(q => q.CreatedAt).ToListAsync(ct);
        return rows.OrderBy(q => PlacementRules.Rank(q.Level)).Select(ToDto).ToList();
    }

    public async Task<AdminPlacementGrammarDto> CreateGrammarAsync(SavePlacementGrammarRequest request, CancellationToken ct = default)
    {
        var q = new PlacementGrammarQuestion();
        await ApplyAsync(q, request, ct);
        db.PlacementGrammarQuestions.Add(q);
        auditor.Record(AuditEntities.Placement, q.Id.ToString(), AuditActions.Create, q.Prompt, null, Snapshot(q));
        await db.SaveChangesAsync(ct);
        return ToDto(q);
    }

    public async Task<int> CreateGrammarBatchAsync(SavePlacementGrammarBatchRequest request, CancellationToken ct = default)
    {
        var questions = new List<PlacementGrammarQuestion>();
        foreach (var r in request.Questions ?? [])
        {
            var q = new PlacementGrammarQuestion();
            await ApplyAsync(q, r, ct);
            questions.Add(q);
        }
        if (questions.Count == 0) return 0;
        db.PlacementGrammarQuestions.AddRange(questions);
        foreach (var q in questions)
            auditor.Record(AuditEntities.Placement, q.Id.ToString(), AuditActions.Create, q.Prompt, null, Snapshot(q));
        await db.SaveChangesAsync(ct);
        return questions.Count;
    }

    public async Task<AdminPlacementGrammarDto> UpdateGrammarAsync(Guid id, SavePlacementGrammarRequest request, CancellationToken ct = default)
    {
        var q = await db.PlacementGrammarQuestions.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy câu hỏi.");
        var before = Snapshot(q);
        await ApplyAsync(q, request, ct);
        q.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Placement, q.Id.ToString(), AuditActions.Update, q.Prompt, before, Snapshot(q));
        await db.SaveChangesAsync(ct);
        return ToDto(q);
    }

    public async Task DeleteGrammarAsync(Guid id, CancellationToken ct = default)
    {
        var q = await db.PlacementGrammarQuestions.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy câu hỏi.");
        db.PlacementGrammarQuestions.Remove(q);
        auditor.Record(AuditEntities.Placement, q.Id.ToString(), AuditActions.Delete, q.Prompt, Snapshot(q), null);
        await db.SaveChangesAsync(ct);
    }

    private async Task ApplyAsync(PlacementGrammarQuestion q, SavePlacementGrammarRequest r, CancellationToken ct)
    {
        var clean = Normalize(r);
        var errors = GrammarPlacementRules.Validate(clean);
        if (clean.LessonSlug is { } slug && !await db.GrammarLessons.AnyAsync(l => l.Slug == slug, ct))
            errors.Add($"Không có bài ngữ pháp \"{slug}\".");
        if (errors.Count > 0) throw new InvalidOperationException(string.Join(" ", errors));

        q.Level = clean.Level;
        q.Prompt = clean.Prompt;
        q.Options = clean.Options;
        q.Answer = clean.Answer;
        q.ExplanationVi = clean.ExplanationVi ?? "";
        q.LessonSlug = clean.LessonSlug;
        q.Published = clean.Published;
    }

    private static SavePlacementGrammarRequest Normalize(SavePlacementGrammarRequest r) => new(
        (r.Level ?? "").Trim().ToUpperInvariant(),
        Clean(r.Prompt) ?? "",
        (r.Options ?? []).Select(o => Clean(o) ?? "").ToList(),
        Clean(r.Answer) ?? "",
        Clean(r.ExplanationVi),
        Clean(r.LessonSlug),
        r.Published);

    private static AdminPlacementGrammarDto ToDto(PlacementGrammarQuestion q) =>
        new(q.Id, q.Level, q.Prompt, q.Options, q.Answer, q.ExplanationVi, q.LessonSlug, q.Published, q.UpdatedAt);

    private static object Snapshot(PlacementGrammarQuestion q) =>
        new { q.Level, q.Prompt, q.Options, q.Answer, q.ExplanationVi, q.LessonSlug, q.Published };

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : WhiteSpace().Replace(s.Trim(), " ");

    private const string DraftInstructions = """
        You write multiple-choice grammar questions for the placement test of 4UME, an English-learning app for Vietnamese adults.
        The test decides which grammar lesson a learner should start from, so each question must clearly test ONE grammar point of its lesson.

        Rules:
        - "prompt": one natural English sentence with ___ for the gap (preferred), or the instruction "Chọn câu đúng." when the options are whole sentences.
        - "options": 3 or 4 distinct options; "answer": exactly one of them. Distractors are typical mistakes Vietnamese learners make with that point.
        - Exactly one option may be correct; vocabulary must stay within the given CEFR level.
        - Everyday situations, friendly content suitable for all ages; no brands, politics or celebrities.
        - "lessonSlug": the slug of the lesson the question tests, taken from the given list.
        - "explanationVi": one short Vietnamese sentence explaining the rule (for the editor, not shown in the test).
        - Never repeat or lightly reword the existing questions given in the request.
        """;

    private const string CheckInstructions = """
        You are a strict English teacher checking multiple-choice grammar questions for a placement test for Vietnamese learners.
        For each question decide whether it is usable: the answer is correct and natural, no other option is also correct,
        the question tests the grammar point of its lesson, and the level is right.
        Reply "ok": true when it is fine. Otherwise "ok": false and "problemVi": one short Vietnamese sentence saying what is wrong.
        """;

    public async Task<PlacementGrammarDraftDto> DraftGrammarAsync(PlacementGrammarDraftRequest request, CancellationToken ct = default)
    {
        if (!gemini.Configured) throw new InvalidOperationException("Chưa cấu hình Gemini (GEMINI_API_KEY) trên máy chủ.");
        var level = (request.Level ?? "").Trim().ToUpperInvariant();
        if (PlacementRules.Rank(level) < 0) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        var count = Math.Clamp(request.Count, 1, GrammarPlacementRules.MaxDraftCount);

        var lessons = await db.GrammarLessons.AsNoTracking()
            .Where(l => l.Level == level && (request.LessonSlug == null || l.Slug == request.LessonSlug))
            .OrderBy(l => l.SortOrder)
            .Select(l => new { l.Slug, l.TitleVi, l.TitleEn, l.SummaryVi })
            .ToListAsync(ct);
        if (lessons.Count == 0) throw new InvalidOperationException($"Chưa có bài ngữ pháp {level} để AI dựa vào.");
        var slugs = lessons.Select(l => l.Slug).ToHashSet();

        var existing = await db.PlacementGrammarQuestions.AsNoTracking()
            .Where(q => q.Level == level)
            .Select(q => q.Prompt)
            .ToListAsync(ct);

        var prompt = new StringBuilder();
        prompt.AppendLine($"Level: {level}.");
        prompt.AppendLine("Grammar lessons at this level (slug — title — summary):");
        foreach (var l in lessons) prompt.AppendLine($"- {l.Slug} — {l.TitleEn} / {l.TitleVi} — {l.SummaryVi}");
        prompt.AppendLine();
        prompt.AppendLine(lessons.Count == 1
            ? $"Write {count} questions about this lesson."
            : $"Write {count} questions, spread over as many different lessons as possible (most important points first).");
        if (!string.IsNullOrWhiteSpace(request.Notes)) prompt.AppendLine($"Extra wishes from the editor (may be in Vietnamese): {request.Notes.Trim()}");
        if (existing.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("Existing questions (do not repeat them):");
            foreach (var e in existing) prompt.AppendLine("- " + e);
        }

        var reply = await gemini.GenerateJsonAsync(DraftInstructions, prompt.ToString(), DraftSchema(), 0.8, ct);
        List<DraftQuestion> drafted;
        try
        {
            drafted = JsonSerializer.Deserialize<DraftReply>(reply, GrammarJson.Options)?.Questions ?? [];
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Gemini returned invalid placement JSON");
            throw new InvalidOperationException("Gemini trả về dữ liệu không đúng khuôn, hãy bấm soạn lại.");
        }
        var questions = drafted
            .Select(d => Normalize(new SavePlacementGrammarRequest(
                level, d.Prompt ?? "", d.Options ?? [], d.Answer ?? "", d.ExplanationVi,
                d.LessonSlug is { } s && slugs.Contains(s) ? s : null)))
            .Take(count)
            .ToList();
        if (questions.Count == 0) throw new InvalidOperationException("Gemini không soạn được câu nào, hãy thử lại.");

        var (warnings, isChecked) = request.SkipCheck ? ([], false) : await CheckAsync(level, questions, ct);
        var items = questions.Select((q, i) =>
        {
            var problems = GrammarPlacementRules.Validate(q);
            if (q.LessonSlug is null) problems.Add("Chưa gắn với bài ngữ pháp nào.");
            return new PlacementGrammarDraftItemDto(q, problems, warnings.GetValueOrDefault(i));
        }).ToList();
        return new PlacementGrammarDraftDto(items, isChecked);
    }

    private async Task<(Dictionary<int, string> Warnings, bool Checked)> CheckAsync(string level, List<SavePlacementGrammarRequest> questions, CancellationToken ct)
    {
        var prompt = new StringBuilder();
        prompt.AppendLine($"Level: {level}. Questions (JSON, check each one by its index):");
        prompt.AppendLine(JsonSerializer.Serialize(
            questions.Select((q, i) => new { index = i, q.Prompt, q.Options, q.Answer, lesson = q.LessonSlug }), GrammarJson.Options));
        try
        {
            var reply = await gemini.GenerateJsonAsync(CheckInstructions, prompt.ToString(), CheckSchema(), 0, ct);
            var results = JsonSerializer.Deserialize<CheckReply>(reply, GrammarJson.Options)?.Results ?? [];
            return (results
                .Where(r => !r.Ok && r.Index >= 0 && r.Index < questions.Count)
                .GroupBy(r => r.Index)
                .ToDictionary(g => g.Key, g => string.IsNullOrWhiteSpace(g.First().ProblemVi) ? "AI nghi câu này có vấn đề." : g.First().ProblemVi!.Trim()), true);
        }
        catch (Exception ex) when (ex is InvalidOperationException or JsonException or HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Placement draft check failed");
            return ([], false);
        }
    }

    private static JsonObject DraftSchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["questions"] = new JsonObject
            {
                ["type"] = "ARRAY",
                ["items"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["prompt"] = Str(),
                        ["options"] = new JsonObject { ["type"] = "ARRAY", ["items"] = Str() },
                        ["answer"] = Str(),
                        ["lessonSlug"] = Str(),
                        ["explanationVi"] = Str(),
                    },
                    ["required"] = Names("prompt", "options", "answer", "lessonSlug", "explanationVi"),
                },
            },
        },
        ["required"] = Names("questions"),
    };

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
        public List<DraftQuestion> Questions { get; set; } = [];
    }

    private sealed class DraftQuestion
    {
        public string? Prompt { get; set; }
        public List<string>? Options { get; set; }
        public string? Answer { get; set; }
        public string? LessonSlug { get; set; }
        public string? ExplanationVi { get; set; }
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
}
