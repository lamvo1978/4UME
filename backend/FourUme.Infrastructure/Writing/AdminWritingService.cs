using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Writing;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Admin;
using FourUme.Infrastructure.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Writing;

public sealed partial class AdminWritingService(
    IAppDbContext db,
    Auditor auditor,
    AiClient ai,
    WritingGrader grader,
    ILogger<AdminWritingService> logger) : IAdminWritingService
{
    private const string ConfigSummary = "Thông số luyện viết AI";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<AdminWritingPromptDto>> GetPromptsAsync(CancellationToken ct = default)
    {
        var rows = await db.WritingPrompts.AsNoTracking().OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt).ToListAsync(ct);
        var uses = await db.WritingSubmissions.AsNoTracking()
            .Where(s => s.PromptId != null)
            .GroupBy(s => s.PromptId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);
        return rows.OrderBy(p => Array.IndexOf(WritingRules.Levels, p.Level))
            .Select(p => ToDto(p, uses.GetValueOrDefault(p.Id)))
            .ToList();
    }

    public async Task<AdminWritingPromptDto> CreateAsync(SaveWritingPromptRequest request, CancellationToken ct = default)
    {
        var p = new WritingPrompt { SortOrder = await NextSortOrderAsync(ct) };
        Apply(p, request);
        db.WritingPrompts.Add(p);
        auditor.Record(AuditEntities.Writing, p.Id.ToString(), AuditActions.Create, p.TitleVi, null, Snapshot(p));
        await db.SaveChangesAsync(ct);
        return ToDto(p, 0);
    }

    public async Task<int> CreateBatchAsync(SaveWritingPromptBatchRequest request, CancellationToken ct = default)
    {
        var order = await NextSortOrderAsync(ct);
        var created = new List<WritingPrompt>();
        foreach (var r in request.Prompts ?? [])
        {
            var p = new WritingPrompt { SortOrder = order++ };
            Apply(p, r);
            created.Add(p);
        }
        if (created.Count == 0) return 0;
        db.WritingPrompts.AddRange(created);
        foreach (var p in created)
            auditor.Record(AuditEntities.Writing, p.Id.ToString(), AuditActions.Create, p.TitleVi, null, Snapshot(p));
        await db.SaveChangesAsync(ct);
        return created.Count;
    }

    public async Task<AdminWritingPromptDto> UpdateAsync(Guid id, SaveWritingPromptRequest request, CancellationToken ct = default)
    {
        var p = await db.WritingPrompts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException();
        var before = Snapshot(p);
        Apply(p, request);
        p.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Writing, p.Id.ToString(), AuditActions.Update, p.TitleVi, before, Snapshot(p));
        await db.SaveChangesAsync(ct);
        var uses = await db.WritingSubmissions.CountAsync(s => s.PromptId == id, ct);
        return ToDto(p, uses);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var p = await db.WritingPrompts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException();
        db.WritingPrompts.Remove(p);
        auditor.Record(AuditEntities.Writing, p.Id.ToString(), AuditActions.Delete, p.TitleVi, Snapshot(p), null);
        await db.SaveChangesAsync(ct);
    }

    public async Task<AdminWritingConfigDto> GetConfigAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == WritingConfig.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminWritingConfigDto(await WritingService.LoadConfigAsync(db, ct), new WritingConfig(), updated, await GetUsageAsync(ct),
            ai.WritingProviders);
    }

    public async Task<AdminWritingConfigDto> SaveConfigAsync(WritingConfig config, CancellationToken ct = default)
    {
        await ApplyConfigAsync(config, AuditActions.Update, ct);
        return await GetConfigAsync(ct);
    }

    public async Task<AdminWritingConfigDto> ResetConfigAsync(CancellationToken ct = default)
    {
        var before = await WritingService.LoadConfigAsync(db, ct);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == WritingConfig.SettingKey, ct);
        if (row is not null) db.AppSettings.Remove(row);
        auditor.Record(AuditEntities.Settings, WritingConfig.SettingKey, AuditActions.Update, ConfigSummary, before, new WritingConfig());
        await db.SaveChangesAsync(ct);
        return await GetConfigAsync(ct);
    }

    public Task RestoreConfigAsync(WritingConfig config, CancellationToken ct = default) =>
        ApplyConfigAsync(config, AuditActions.Restore, ct);

    public async Task<WritingTryDto> TryAsync(WritingTryRequest request, CancellationToken ct = default)
    {
        var level = (request.Level ?? "").Trim().ToUpperInvariant();
        if (!WritingRules.Levels.Contains(level)) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        var text = WritingGrader.NormalizeText(request.Text);
        if (WritingRules.CountWords(text) < WritingRules.MinWords) throw new InvalidOperationException($"Bài cần ít nhất {WritingRules.MinWords} từ.");
        if (text.Length > WritingRules.MaxText) throw new InvalidOperationException($"Bài dài quá {WritingRules.MaxText} ký tự.");
        var provider = (request.Provider ?? "").Trim().ToLowerInvariant();
        if (provider.Length > 0 && !WritingRules.AllowedProviders.Contains(provider)) throw new InvalidOperationException("AI không hợp lệ.");
        if (provider.Length > 0 && !ai.IsConfigured(provider)) throw new InvalidOperationException($"Chưa cấu hình {provider} trên máy chủ.");

        IReadOnlyList<string> providers = provider.Length > 0 ? [provider] : (await WritingService.LoadConfigAsync(db, ct)).Providers;
        var (min, max) = WritingRules.WordRange(level);
        var promptEn = string.IsNullOrWhiteSpace(request.PromptEn) ? null : request.PromptEn.Trim();
        var watch = Stopwatch.StartNew();
        var (result, model) = await grader.GradeAsync(providers, new WritingTask(level, promptEn, null, min, max), text, ct,
            provider.Length > 0 ? request.Model : null);
        return new WritingTryDto(result, model, (int)watch.ElapsedMilliseconds);
    }

    private async Task ApplyConfigAsync(WritingConfig config, string action, CancellationToken ct)
    {
        config = config with
        {
            Providers = (config.Providers ?? []).Select(p => p.Trim().ToLowerInvariant()).Distinct().ToList(),
            PremiumProviders = (config.PremiumProviders ?? []).Select(p => p.Trim().ToLowerInvariant()).Distinct().ToList(),
        };
        var problems = WritingRules.Validate(config);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        var before = await WritingService.LoadConfigAsync(db, ct);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == WritingConfig.SettingKey, ct);
        if (row is null)
        {
            row = new AppSetting { Key = WritingConfig.SettingKey };
            db.AppSettings.Add(row);
        }
        row.Value = JsonSerializer.Serialize(config, Json);
        row.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Settings, WritingConfig.SettingKey, action, ConfigSummary, before, config);
        await db.SaveChangesAsync(ct);
    }

    private async Task<WritingUsageDto> GetUsageAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var month = new DateTimeOffset(new DateTime(now.Year, now.Month, 1), TimeSpan.Zero);
        var since = WritingService.UtcDayStart();
        var today = await db.WritingSubmissions.AsNoTracking().CountAsync(s => s.CreatedAt >= since, ct);
        var rows = db.WritingSubmissions.AsNoTracking().Where(s => s.CreatedAt >= month);
        var count = await rows.CountAsync(ct);
        var users = await rows.Select(s => s.UserId).Distinct().CountAsync(ct);
        var average = count == 0 ? 0 : await rows.AverageAsync(s => (double)s.Score, ct);
        var models = await rows.GroupBy(s => s.Model).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        return new WritingUsageDto(today, count, users, Math.Round(average, 1), models);
    }

    private const string DraftInstructions = """
        You write writing tasks for "Luyện viết với AI" in 4UME, an English-learning app for Vietnamese adults.
        The learner writes one short text in English and an AI grades it, so tasks must be things a Vietnamese adult really writes
        or talks about: daily life, family, work, study, travel, food, health, technology, opinions, short emails and messages.

        Fields:
        - "titleVi": short Vietnamese title (max 60 characters), e.g. "Giới thiệu bản thân".
        - "icon": one Ionicons name that fits, e.g. "person-outline", "mail-outline", "home-outline", "airplane-outline",
          "briefcase-outline", "restaurant-outline", "school-outline", "heart-outline", "chatbubble-outline", "bulb-outline".
        - "promptEn": the task in clear English at the level, 1–3 sentences, saying what to write and what to include
          (e.g. "Write an email to a friend about your weekend. Say where you went, who you were with and what you liked.").
        - "guideVi": one short Vietnamese sentence listing what to include.
        - "minWords" and "maxWords": suggested length (A1 about 30–80, A2 50–120, B1 80–180, B2 120–250).
        - "keyPhrases": 3–5 short English phrases or sentence starters that help, at the level.

        Fit the CEFR level: A1 simple descriptions of self and daily life, A2 simple past events, plans and short messages,
        B1 experiences, explanations, opinions with reasons and informal emails, B2 arguments, comparisons, formal emails and reviews.
        Never repeat or lightly reword the existing tasks listed in the request.
        """;

    public async Task<WritingPromptDraftDto> DraftAsync(WritingPromptDraftRequest request, CancellationToken ct = default)
    {
        if (!ai.Configured && !ai.IsConfigured(request.Provider ?? "")) throw new InvalidOperationException(AiClient.NotConfiguredMessage);
        var level = (request.Level ?? "").Trim().ToUpperInvariant();
        if (!WritingRules.Levels.Contains(level)) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        var count = Math.Clamp(request.Count, 1, WritingRules.MaxDraftCount);

        var existing = await db.WritingPrompts.AsNoTracking().Select(p => new { p.Level, p.TitleVi }).ToListAsync(ct);
        var keys = existing.Select(p => WritingRules.Key(p.TitleVi)).ToHashSet();

        var prompt = new StringBuilder();
        prompt.AppendLine($"Level: {level}.");
        prompt.AppendLine($"Write {count} tasks.");
        if (!string.IsNullOrWhiteSpace(request.Topic)) prompt.AppendLine($"Topic for all tasks: {request.Topic.Trim()}");
        if (!string.IsNullOrWhiteSpace(request.Notes)) prompt.AppendLine($"Extra wishes from the editor (may be in Vietnamese): {request.Notes.Trim()}");
        if (existing.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("Existing tasks (do not repeat them):");
            foreach (var e in existing) prompt.AppendLine($"- [{e.Level}] {e.TitleVi}");
        }

        var reply = await ai.GenerateJsonAsync(DraftInstructions, prompt.ToString(), DraftSchema(), 0.9, ct, request.Provider);
        List<DraftPrompt> drafted;
        try
        {
            drafted = JsonSerializer.Deserialize<DraftReply>(reply.Text, Json)?.Prompts ?? [];
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "AI returned invalid writing prompt JSON");
            throw new InvalidOperationException("AI trả về dữ liệu không đúng khuôn, hãy bấm soạn lại.");
        }

        var seen = new HashSet<string>();
        var items = drafted
            .Take(count)
            .Select(d => Normalize(new SaveWritingPromptRequest(level, d.TitleVi ?? "", d.Icon, d.PromptEn ?? "", d.GuideVi,
                (int)Math.Round(d.MinWords), (int)Math.Round(d.MaxWords), d.KeyPhrases)))
            .Select(p =>
            {
                var key = WritingRules.Key(p.TitleVi);
                return new WritingPromptDraftItemDto(p, WritingRules.Validate(p), keys.Contains(key) || !seen.Add(key));
            })
            .ToList();
        if (items.Count == 0) throw new InvalidOperationException("AI không soạn được đề nào, hãy thử lại.");
        return new WritingPromptDraftDto(items, reply.Model);
    }

    private static JsonObject DraftSchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["prompts"] = new JsonObject
            {
                ["type"] = "ARRAY",
                ["items"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["titleVi"] = Str(),
                        ["icon"] = Str(),
                        ["promptEn"] = Str(),
                        ["guideVi"] = Str(),
                        ["minWords"] = new JsonObject { ["type"] = "INTEGER" },
                        ["maxWords"] = new JsonObject { ["type"] = "INTEGER" },
                        ["keyPhrases"] = new JsonObject { ["type"] = "ARRAY", ["items"] = Str() },
                    },
                    ["required"] = Names("titleVi", "icon", "promptEn", "guideVi", "minWords", "maxWords", "keyPhrases"),
                },
            },
        },
        ["required"] = Names("prompts"),
    };

    private async Task<int> NextSortOrderAsync(CancellationToken ct) =>
        (await db.WritingPrompts.MaxAsync(p => (int?)p.SortOrder, ct) ?? 0) + 1;

    private static void Apply(WritingPrompt p, SaveWritingPromptRequest request)
    {
        var clean = Normalize(request);
        var errors = WritingRules.Validate(clean);
        if (errors.Count > 0) throw new InvalidOperationException(string.Join(" ", errors));
        Assign(p, clean);
    }

    internal static void Assign(WritingPrompt p, SaveWritingPromptRequest clean)
    {
        p.Level = clean.Level;
        p.TitleVi = clean.TitleVi;
        p.Icon = string.IsNullOrEmpty(clean.Icon) ? WritingRules.DefaultIcon : clean.Icon;
        p.PromptEn = clean.PromptEn;
        p.GuideVi = clean.GuideVi ?? "";
        p.MinWords = clean.MinWords;
        p.MaxWords = clean.MaxWords;
        p.KeyPhrases = clean.KeyPhrases ?? [];
        p.Published = clean.Published;
    }

    internal static SaveWritingPromptRequest Normalize(SaveWritingPromptRequest r) => new(
        (r.Level ?? "").Trim().ToUpperInvariant(),
        Clean(r.TitleVi) ?? "",
        Clean(r.Icon)?.ToLowerInvariant(),
        Clean(r.PromptEn) ?? "",
        Clean(r.GuideVi),
        Math.Max(0, r.MinWords),
        Math.Max(0, r.MaxWords),
        (r.KeyPhrases ?? []).Select(Clean).OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
        r.Published);

    private static AdminWritingPromptDto ToDto(WritingPrompt p, int uses) => new(
        p.Id, p.Level, p.TitleVi, p.Icon, p.PromptEn, p.GuideVi, p.MinWords, p.MaxWords, p.KeyPhrases, p.Published, p.SortOrder, uses, p.UpdatedAt);

    private static object Snapshot(WritingPrompt p) =>
        new { p.Level, p.TitleVi, p.Icon, p.PromptEn, p.GuideVi, p.MinWords, p.MaxWords, p.KeyPhrases, p.Published };

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : WhiteSpace().Replace(s.Trim(), " ");

    private sealed class DraftReply
    {
        public List<DraftPrompt> Prompts { get; set; } = [];
    }

    private sealed class DraftPrompt
    {
        public string? TitleVi { get; set; }
        public string? Icon { get; set; }
        public string? PromptEn { get; set; }
        public string? GuideVi { get; set; }
        public double MinWords { get; set; }
        public double MaxWords { get; set; }
        public List<string>? KeyPhrases { get; set; }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();
}
