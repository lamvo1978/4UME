using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Application.Practice;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Ai;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Practice;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Admin;

public sealed partial class AdminPracticeService(
    IAppDbContext db,
    Auditor auditor,
    AiClient ai,
    AzureSpeechClient speech,
    ListeningAudioJobs listeningJobs,
    SentenceAudioJobs audioJobs,
    ILogger<AdminPracticeService> logger) : IAdminPracticeService
{
    public async Task<IReadOnlyList<AdminPracticeSentenceDto>> GetAllAsync(CancellationToken ct = default)
    {
        var rows = await db.PracticeSentences.AsNoTracking().OrderByDescending(s => s.CreatedAt).ToListAsync(ct);
        return rows.OrderBy(s => Array.IndexOf(PracticeRules.Levels, s.Level)).Select(ToDto).ToList();
    }

    public async Task<AdminPracticeSentenceDto> CreateAsync(SavePracticeSentenceRequest request, CancellationToken ct = default)
    {
        var s = new PracticeSentence();
        Apply(s, request);
        db.PracticeSentences.Add(s);
        auditor.Record(AuditEntities.Sentence, s.Id.ToString(), AuditActions.Create, s.En, null, Snapshot(s));
        await db.SaveChangesAsync(ct);
        return ToDto(s);
    }

    public async Task<int> CreateBatchAsync(SavePracticeSentenceBatchRequest request, CancellationToken ct = default)
    {
        var sentences = new List<PracticeSentence>();
        foreach (var r in request.Sentences ?? [])
        {
            var s = new PracticeSentence();
            Apply(s, r);
            sentences.Add(s);
        }
        if (sentences.Count == 0) return 0;
        db.PracticeSentences.AddRange(sentences);
        foreach (var s in sentences)
            auditor.Record(AuditEntities.Sentence, s.Id.ToString(), AuditActions.Create, s.En, null, Snapshot(s));
        await db.SaveChangesAsync(ct);
        return sentences.Count;
    }

    public async Task<AdminPracticeSentenceDto> UpdateAsync(Guid id, SavePracticeSentenceRequest request, CancellationToken ct = default)
    {
        var s = await db.PracticeSentences.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy câu.");
        var before = Snapshot(s);
        Apply(s, request);
        s.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Sentence, s.Id.ToString(), AuditActions.Update, s.En, before, Snapshot(s));
        await db.SaveChangesAsync(ct);
        return ToDto(s);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var s = await db.PracticeSentences.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy câu.");
        db.PracticeSentences.Remove(s);
        auditor.Record(AuditEntities.Sentence, s.Id.ToString(), AuditActions.Delete, s.En, Snapshot(s), null);
        await db.SaveChangesAsync(ct);
        audioJobs.DeleteAudio(s.AudioUrl);
    }

    public async Task<SentenceAudioStatusDto> GetAudioStatusAsync(CancellationToken ct = default)
    {
        var missing = await db.PracticeSentences.CountAsync(s => s.Published && (s.AudioUrl == null || s.AudioText != s.En), ct);
        var usage = await listeningJobs.GetUsageAsync(db, ct);
        var job = audioJobs.Current;
        return new SentenceAudioStatusDto(speech.Options.Configured, job?.Running ?? false, job?.Done ?? 0, job?.Total ?? 0, job?.Error,
            missing, usage.Chars, speech.Options.MonthlyCharLimit);
    }

    public async Task<SentenceAudioStatusDto> StartAudioAsync(CancellationToken ct = default)
    {
        if (!speech.Options.Configured) throw new InvalidOperationException("Chưa cấu hình Azure Speech trên máy chủ.");
        var todo = await db.PracticeSentences.AsNoTracking()
            .Where(s => s.Published && (s.AudioUrl == null || s.AudioText != s.En))
            .OrderBy(s => s.CreatedAt)
            .Select(s => new { s.Id, s.En })
            .ToListAsync(ct);
        if (todo.Count == 0) throw new InvalidOperationException("Mọi câu đã xuất bản đều có giọng đọc rồi.");

        var usage = await listeningJobs.GetUsageAsync(db, ct);
        var needed = todo.Sum(s => AzureSpeechClient.BilledChars(s.En));
        if (usage.Chars + needed > speech.Options.MonthlyCharLimit)
            throw new InvalidOperationException(
                $"Tháng này đã dùng khoảng {usage.Chars:N0}/{speech.Options.MonthlyCharLimit:N0} ký tự; {todo.Count} câu cần khoảng {needed:N0}. Hãy đợi sang tháng.");

        audioJobs.Start(todo.Select(s => s.Id).ToList());
        auditor.Record(AuditEntities.Sentence, "audio", AuditActions.Generate, $"Tạo giọng đọc cho {todo.Count} câu", null, null);
        await db.SaveChangesAsync(ct);
        return await GetAudioStatusAsync(ct);
    }

    public async Task<IReadOnlyList<PracticeSentenceFileItem>> ExportAsync(CancellationToken ct = default)
    {
        var rows = await db.PracticeSentences.AsNoTracking().OrderBy(s => s.CreatedAt).ToListAsync(ct);
        return rows.OrderBy(s => Array.IndexOf(PracticeRules.Levels, s.Level))
            .Select(s => new PracticeSentenceFileItem(s.Id, s.Level, s.Topic, s.En, s.Vi, s.Published))
            .ToList();
    }

    /// <summary>Creates sentences without an id and updates the ones with an id; never deletes, so a partial file is safe.</summary>
    public async Task<ImportPracticeSentencesResult> ImportAsync(ImportPracticeSentencesRequest request, CancellationToken ct = default)
    {
        var items = request.Sentences ?? [];
        if (items.Count == 0) throw new InvalidOperationException("File không có câu nào.");
        var existing = await db.PracticeSentences.ToDictionaryAsync(s => s.Id, ct);
        var keys = existing.Values.ToDictionary(s => s.Id, s => PracticeRules.Key(s.En));
        var seen = new HashSet<Guid>();
        var seenKeys = new HashSet<string>();
        var rows = new List<ImportPracticeSentenceRow>();
        var plans = new List<(PracticeSentence? Current, SavePracticeSentenceRequest Clean)>();

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var clean = Normalize(new SavePracticeSentenceRequest(item.Level, item.Topic, item.En, item.Vi, item.Published));
            var problems = PracticeRules.Validate(clean);
            PracticeSentence? current = null;
            if (item.Id is { } id)
            {
                if (!seen.Add(id)) problems.Insert(0, "Id bị lặp trong file.");
                else if (!existing.TryGetValue(id, out current)) problems.Insert(0, "Không có câu với id này (xoá id để tạo câu mới).");
            }
            var key = PracticeRules.Key(clean.En);
            if (key.Length > 0 && (!seenKeys.Add(key) || keys.Any(k => k.Value == key && k.Key != current?.Id)))
                problems.Add("Câu này đã có (trong ngân hàng hoặc trong file).");

            string status;
            if (problems.Count > 0) status = ImportStatus.Error;
            else if (current is null) status = ImportStatus.Create;
            else if (JsonSerializer.Serialize(Snapshot(current)) == JsonSerializer.Serialize(SnapshotOf(clean))) status = ImportStatus.Unchanged;
            else status = ImportStatus.Update;

            if (status is ImportStatus.Create or ImportStatus.Update) plans.Add((current, clean));
            rows.Add(new ImportPracticeSentenceRow(i + 1, item.Id, clean.Level, clean.En, status, problems));
        }

        var committed = false;
        if (request.Commit && plans.Count > 0)
        {
            foreach (var (current, clean) in plans)
            {
                if (current is not null)
                {
                    var before = Snapshot(current);
                    Assign(current, clean);
                    current.UpdatedAt = DateTimeOffset.UtcNow;
                    auditor.Record(AuditEntities.Sentence, current.Id.ToString(), AuditActions.Import, current.En, before, Snapshot(current));
                }
                else
                {
                    var s = new PracticeSentence();
                    Assign(s, clean);
                    db.PracticeSentences.Add(s);
                    auditor.Record(AuditEntities.Sentence, s.Id.ToString(), AuditActions.Import, s.En, null, Snapshot(s));
                }
            }
            await db.SaveChangesAsync(ct);
            committed = true;
        }

        return new ImportPracticeSentencesResult(
            rows.Count(r => r.Status == ImportStatus.Create),
            rows.Count(r => r.Status == ImportStatus.Update),
            rows.Count(r => r.Status == ImportStatus.Unchanged),
            rows.Count(r => r.Status == ImportStatus.Error),
            committed,
            rows);
    }

    private static void Apply(PracticeSentence s, SavePracticeSentenceRequest r)
    {
        var clean = Normalize(r);
        var errors = PracticeRules.Validate(clean);
        if (errors.Count > 0) throw new InvalidOperationException(string.Join(" ", errors));
        Assign(s, clean);
    }

    private static void Assign(PracticeSentence s, SavePracticeSentenceRequest clean)
    {
        s.Level = clean.Level;
        s.Topic = clean.Topic ?? "";
        s.En = clean.En;
        s.Vi = clean.Vi;
        s.Published = clean.Published;
    }

    private static SavePracticeSentenceRequest Normalize(SavePracticeSentenceRequest r) => new(
        (r.Level ?? "").Trim().ToUpperInvariant(),
        Clean(r.Topic)?.ToLowerInvariant(),
        Clean(r.En) ?? "",
        Clean(r.Vi) ?? "",
        r.Published);

    private static AdminPracticeSentenceDto ToDto(PracticeSentence s) => new(
        s.Id, s.Level, s.Topic, s.En, s.Vi, s.Published, s.AudioUrl,
        s.AudioUrl is null ? SentenceAudioStates.None : s.AudioText == s.En ? SentenceAudioStates.Ready : SentenceAudioStates.Stale,
        s.UpdatedAt);

    private static object Snapshot(PracticeSentence s) => new { s.Level, s.Topic, s.En, s.Vi, s.Published };

    private static object SnapshotOf(SavePracticeSentenceRequest r) => new { r.Level, Topic = r.Topic ?? "", r.En, r.Vi, r.Published };

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : WhiteSpace().Replace(s.Trim(), " ");

    private const string DraftInstructions = """
        You write sentences for the "listen and repeat / listen and write" practice of 4UME, an English-learning app for Vietnamese adults.
        The learner hears each sentence once or twice, then types it or says it aloud, so every sentence must be easy to hear and to write.

        Rules:
        - "en": one natural, complete English sentence a person would really say or write in daily life, ending with . ? or !
        - Length and vocabulary fit the CEFR level: A1 4–8 words, A2 6–11, B1 8–15, B2 10–20. Use only common words at that level.
        - Plain ASCII apostrophes and quotes; no names that are hard to spell, no numbers written as digits, no abbreviations, no brands, politics or celebrities.
        - Vary the grammar (statements, questions, negatives, different tenses) and the situations.
        - "vi": a natural Vietnamese translation (meaning, not word by word).
        - "topic": one or two lowercase English words for the situation, e.g. "travel", "work", "food", "health".
        - Never repeat or lightly reword the existing sentences given in the request.
        """;

    public async Task<PracticeDraftDto> DraftAsync(PracticeDraftRequest request, CancellationToken ct = default)
    {
        if (!ai.Configured) throw new InvalidOperationException(AiClient.NotConfiguredMessage);
        var level = (request.Level ?? "").Trim().ToUpperInvariant();
        if (!PracticeRules.Levels.Contains(level)) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        var count = Math.Clamp(request.Count, 1, PracticeRules.MaxDraftCount);

        var existing = await db.PracticeSentences.AsNoTracking()
            .Where(s => s.Level == level)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => s.En)
            .Take(300)
            .ToListAsync(ct);
        var allKeys = (await db.PracticeSentences.AsNoTracking().Select(s => s.En).ToListAsync(ct))
            .Select(PracticeRules.Key).ToHashSet();

        var prompt = new StringBuilder();
        prompt.AppendLine($"Level: {level}.");
        prompt.AppendLine($"Write {count} sentences.");
        if (!string.IsNullOrWhiteSpace(request.Topic)) prompt.AppendLine($"Situation/topic for all sentences: {request.Topic.Trim()}");
        if (!string.IsNullOrWhiteSpace(request.Notes)) prompt.AppendLine($"Extra wishes from the editor (may be in Vietnamese): {request.Notes.Trim()}");
        if (existing.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("Existing sentences (do not repeat them):");
            foreach (var e in existing) prompt.AppendLine("- " + e);
        }

        var reply = await ai.GenerateJsonAsync(DraftInstructions, prompt.ToString(), DraftSchema(), 0.9, ct, request.Provider);
        List<DraftSentence> drafted;
        try
        {
            drafted = JsonSerializer.Deserialize<DraftReply>(reply.Text, GrammarJson.Options)?.Sentences ?? [];
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "AI returned invalid practice JSON");
            throw new InvalidOperationException("AI trả về dữ liệu không đúng khuôn, hãy bấm soạn lại.");
        }

        var seen = new HashSet<string>();
        var items = drafted
            .Select(d => Normalize(new SavePracticeSentenceRequest(level, d.Topic ?? request.Topic, d.En ?? "", d.Vi ?? "")))
            .Take(count)
            .Select(s =>
            {
                var key = PracticeRules.Key(s.En);
                return new PracticeDraftItemDto(s, PracticeRules.Validate(s), allKeys.Contains(key) || !seen.Add(key));
            })
            .ToList();
        if (items.Count == 0) throw new InvalidOperationException("AI không soạn được câu nào, hãy thử lại.");
        return new PracticeDraftDto(items, reply.Model);
    }

    private static JsonObject DraftSchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["sentences"] = new JsonObject
            {
                ["type"] = "ARRAY",
                ["items"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["en"] = Str(),
                        ["vi"] = Str(),
                        ["topic"] = Str(),
                    },
                    ["required"] = Names("en", "vi", "topic"),
                },
            },
        },
        ["required"] = Names("sentences"),
    };

    private sealed class DraftReply
    {
        public List<DraftSentence> Sentences { get; set; } = [];
    }

    private sealed class DraftSentence
    {
        public string? En { get; set; }
        public string? Vi { get; set; }
        public string? Topic { get; set; }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();
}
