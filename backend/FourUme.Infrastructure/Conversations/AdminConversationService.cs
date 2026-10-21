using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Conversations;
using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Admin;
using FourUme.Infrastructure.Ai;
using FourUme.Infrastructure.Listening;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Conversations;

public sealed partial class AdminConversationService(
    IAppDbContext db,
    Auditor auditor,
    AiClient ai,
    AzureSpeechClient speech,
    ListeningAudioJobs speechUsage,
    ConversationVoice voice,
    ILogger<AdminConversationService> logger) : IAdminConversationService
{
    private const string ConfigSummary = "Thông số đàm thoại AI";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<AdminConversationScenarioDto>> GetScenariosAsync(CancellationToken ct = default)
    {
        var rows = await db.ConversationScenarios.AsNoTracking().OrderBy(s => s.SortOrder).ThenBy(s => s.CreatedAt).ToListAsync(ct);
        var uses = await db.Conversations.AsNoTracking()
            .Where(c => c.ScenarioId != null)
            .GroupBy(c => c.ScenarioId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);
        return rows.OrderBy(s => Array.IndexOf(ConversationRules.Levels, s.Level))
            .Select(s => ToDto(s, uses.GetValueOrDefault(s.Id)))
            .ToList();
    }

    public async Task<AdminConversationScenarioDto> CreateAsync(SaveConversationScenarioRequest request, CancellationToken ct = default)
    {
        var s = new ConversationScenario { SortOrder = await NextSortOrderAsync(ct) };
        Apply(s, request);
        db.ConversationScenarios.Add(s);
        auditor.Record(AuditEntities.Conversation, s.Id.ToString(), AuditActions.Create, s.TitleVi, null, Snapshot(s));
        await db.SaveChangesAsync(ct);
        return ToDto(s, 0);
    }

    public async Task<int> CreateBatchAsync(SaveConversationScenarioBatchRequest request, CancellationToken ct = default)
    {
        var order = await NextSortOrderAsync(ct);
        var created = new List<ConversationScenario>();
        foreach (var r in request.Scenarios ?? [])
        {
            var s = new ConversationScenario { SortOrder = order++ };
            Apply(s, r);
            created.Add(s);
        }
        if (created.Count == 0) return 0;
        db.ConversationScenarios.AddRange(created);
        foreach (var s in created)
            auditor.Record(AuditEntities.Conversation, s.Id.ToString(), AuditActions.Create, s.TitleVi, null, Snapshot(s));
        await db.SaveChangesAsync(ct);
        return created.Count;
    }

    public async Task<AdminConversationScenarioDto> UpdateAsync(Guid id, SaveConversationScenarioRequest request, CancellationToken ct = default)
    {
        var s = await db.ConversationScenarios.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException();
        var before = Snapshot(s);
        Apply(s, request);
        s.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Conversation, s.Id.ToString(), AuditActions.Update, s.TitleVi, before, Snapshot(s));
        await db.SaveChangesAsync(ct);
        var uses = await db.Conversations.CountAsync(c => c.ScenarioId == id, ct);
        return ToDto(s, uses);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var s = await db.ConversationScenarios.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException();
        db.ConversationScenarios.Remove(s);
        auditor.Record(AuditEntities.Conversation, s.Id.ToString(), AuditActions.Delete, s.TitleVi, Snapshot(s), null);
        await db.SaveChangesAsync(ct);
    }

    public async Task<AdminConversationConfigDto> GetConfigAsync(CancellationToken ct = default)
    {
        var updated = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == ConversationConfig.SettingKey)
            .Select(s => (DateTimeOffset?)s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return new AdminConversationConfigDto(await ConversationService.LoadConfigAsync(db, ct), new ConversationConfig(), updated,
            await GetUsageAsync(ct), ai.Providers, speech.Options.Configured, speech.Options.PaidConfigured, ListeningRules.Voices);
    }

    public async Task<AdminConversationConfigDto> SaveConfigAsync(ConversationConfig config, CancellationToken ct = default)
    {
        await ApplyConfigAsync(config, AuditActions.Update, ct);
        return await GetConfigAsync(ct);
    }

    public async Task<AdminConversationConfigDto> ResetConfigAsync(CancellationToken ct = default)
    {
        var before = await ConversationService.LoadConfigAsync(db, ct);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == ConversationConfig.SettingKey, ct);
        if (row is not null) db.AppSettings.Remove(row);
        auditor.Record(AuditEntities.Settings, ConversationConfig.SettingKey, AuditActions.Update, ConfigSummary, before, new ConversationConfig());
        await db.SaveChangesAsync(ct);
        return await GetConfigAsync(ct);
    }

    public Task RestoreConfigAsync(ConversationConfig config, CancellationToken ct = default) =>
        ApplyConfigAsync(config, AuditActions.Restore, ct);

    private async Task ApplyConfigAsync(ConversationConfig config, string action, CancellationToken ct)
    {
        var problems = ConversationRules.Validate(config);
        if (problems.Count > 0) throw new InvalidOperationException(string.Join(" ", problems));
        var before = await ConversationService.LoadConfigAsync(db, ct);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == ConversationConfig.SettingKey, ct);
        if (row is null)
        {
            row = new AppSetting { Key = ConversationConfig.SettingKey };
            db.AppSettings.Add(row);
        }
        row.Value = JsonSerializer.Serialize(config, Json);
        row.UpdatedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditEntities.Settings, ConversationConfig.SettingKey, action, ConfigSummary, before, config);
        await db.SaveChangesAsync(ct);
    }

    private async Task<ConversationUsageDto> GetUsageAsync(CancellationToken ct)
    {
        var month = ConversationVoice.MonthStart();
        var sessions = db.Conversations.AsNoTracking().Where(c => c.StartedAt >= month);
        var count = await sessions.CountAsync(ct);
        var users = await sessions.Select(c => c.UserId).Distinct().CountAsync(ct);
        var turns = await db.ConversationTurns.AsNoTracking().CountAsync(t => t.CreatedAt >= month && t.FromLearner, ct);
        var chars = await voice.GetMonthUsageAsync(ct);
        var speechMonth = await speechUsage.GetUsageAsync(db, ct);
        return new ConversationUsageDto(count, users, turns, chars.FreeChars, chars.PaidChars,
            Math.Round(chars.PaidChars / 1_000_000.0 * ConversationRules.PaidUsdPerMillionChars, 2),
            speechMonth.Chars, speech.Options.MonthlyCharLimit);
    }

    private const string DraftInstructions = """
        You write role-play situations for "Đàm thoại với AI" in 4UME, an English-learning app for Vietnamese adults.
        In each situation the AI plays a character and the learner talks to it by voice, so situations must be things
        a Vietnamese adult really does in English: travel, shopping, restaurants, work, health, small talk, services.

        Fields:
        - "titleVi": short Vietnamese title (max 60 characters), e.g. "Gọi đồ uống ở quán cà phê".
        - "icon": one Ionicons name that fits, e.g. "cafe-outline", "airplane-outline", "bed-outline", "briefcase-outline",
          "cart-outline", "medkit-outline", "restaurant-outline", "map-outline", "call-outline", "people-outline".
        - "situation": 1–2 English sentences describing the place and what is happening, for the AI only.
        - "aiRole": who the AI plays, in English, e.g. "a friendly barista".
        - "goalVi": what the learner must get done, one short Vietnamese sentence.
        - "opening": the AI character's first line in English, at the level, ending with a question.
        - "keyPhrases": 3–5 short English phrases the learner can use, at the level.

        Fit the CEFR level: A1 very simple everyday tasks, A2 simple transactions, B1 problems and explanations
        (complaints, changes, advice), B2 negotiation, opinions and professional situations.
        Never repeat or lightly reword the existing situations listed in the request.
        """;

    public async Task<ConversationScenarioDraftDto> DraftAsync(ConversationScenarioDraftRequest request, CancellationToken ct = default)
    {
        if (!ai.Configured) throw new InvalidOperationException(AiClient.NotConfiguredMessage);
        var level = (request.Level ?? "").Trim().ToUpperInvariant();
        if (!ConversationRules.Levels.Contains(level)) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        var count = Math.Clamp(request.Count, 1, ConversationRules.MaxDraftCount);

        var existing = await db.ConversationScenarios.AsNoTracking().Select(s => new { s.Level, s.TitleVi }).ToListAsync(ct);
        var keys = existing.Select(s => ConversationRules.Key(s.TitleVi)).ToHashSet();

        var prompt = new StringBuilder();
        prompt.AppendLine($"Level: {level}.");
        prompt.AppendLine($"Write {count} situations.");
        if (!string.IsNullOrWhiteSpace(request.Topic)) prompt.AppendLine($"Topic for all situations: {request.Topic.Trim()}");
        if (!string.IsNullOrWhiteSpace(request.Notes)) prompt.AppendLine($"Extra wishes from the editor (may be in Vietnamese): {request.Notes.Trim()}");
        if (existing.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("Existing situations (do not repeat them):");
            foreach (var e in existing) prompt.AppendLine($"- [{e.Level}] {e.TitleVi}");
        }

        var reply = await ai.GenerateJsonAsync(DraftInstructions, prompt.ToString(), DraftSchema(), 0.9, ct, request.Provider);
        List<DraftScenario> drafted;
        try
        {
            drafted = JsonSerializer.Deserialize<DraftReply>(reply.Text, Json)?.Scenarios ?? [];
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "AI returned invalid scenario JSON");
            throw new InvalidOperationException("AI trả về dữ liệu không đúng khuôn, hãy bấm soạn lại.");
        }

        var seen = new HashSet<string>();
        var items = drafted
            .Take(count)
            .Select(d => Normalize(new SaveConversationScenarioRequest(level, d.TitleVi ?? "", d.Icon, d.Situation ?? "", d.AiRole ?? "",
                d.GoalVi ?? "", d.Opening ?? "", d.KeyPhrases)))
            .Select(s =>
            {
                var key = ConversationRules.Key(s.TitleVi);
                return new ConversationScenarioDraftItemDto(s, ConversationRules.Validate(s), keys.Contains(key) || !seen.Add(key));
            })
            .ToList();
        if (items.Count == 0) throw new InvalidOperationException("AI không soạn được tình huống nào, hãy thử lại.");
        return new ConversationScenarioDraftDto(items, reply.Model);
    }

    private static JsonObject DraftSchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["scenarios"] = new JsonObject
            {
                ["type"] = "ARRAY",
                ["items"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["titleVi"] = Str(),
                        ["icon"] = Str(),
                        ["situation"] = Str(),
                        ["aiRole"] = Str(),
                        ["goalVi"] = Str(),
                        ["opening"] = Str(),
                        ["keyPhrases"] = new JsonObject { ["type"] = "ARRAY", ["items"] = Str() },
                    },
                    ["required"] = Names("titleVi", "icon", "situation", "aiRole", "goalVi", "opening", "keyPhrases"),
                },
            },
        },
        ["required"] = Names("scenarios"),
    };

    private async Task<int> NextSortOrderAsync(CancellationToken ct) =>
        (await db.ConversationScenarios.MaxAsync(s => (int?)s.SortOrder, ct) ?? 0) + 1;

    private static void Apply(ConversationScenario s, SaveConversationScenarioRequest request)
    {
        var clean = Normalize(request);
        var errors = ConversationRules.Validate(clean);
        if (errors.Count > 0) throw new InvalidOperationException(string.Join(" ", errors));
        Assign(s, clean);
    }

    internal static void Assign(ConversationScenario s, SaveConversationScenarioRequest clean)
    {
        s.Level = clean.Level;
        s.TitleVi = clean.TitleVi;
        s.Icon = string.IsNullOrEmpty(clean.Icon) ? ConversationRules.DefaultIcon : clean.Icon;
        s.Situation = clean.Situation;
        s.AiRole = clean.AiRole;
        s.GoalVi = clean.GoalVi;
        s.Opening = clean.Opening;
        s.KeyPhrases = clean.KeyPhrases ?? [];
        s.Published = clean.Published;
    }

    internal static SaveConversationScenarioRequest Normalize(SaveConversationScenarioRequest r) => new(
        (r.Level ?? "").Trim().ToUpperInvariant(),
        Clean(r.TitleVi) ?? "",
        Clean(r.Icon)?.ToLowerInvariant(),
        Clean(r.Situation) ?? "",
        Clean(r.AiRole) ?? "",
        Clean(r.GoalVi) ?? "",
        Clean(r.Opening) ?? "",
        (r.KeyPhrases ?? []).Select(Clean).OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
        r.Published);

    private static AdminConversationScenarioDto ToDto(ConversationScenario s, int uses) => new(
        s.Id, s.Level, s.TitleVi, s.Icon, s.Situation, s.AiRole, s.GoalVi, s.Opening, s.KeyPhrases, s.Published, s.SortOrder, uses, s.UpdatedAt);

    private static object Snapshot(ConversationScenario s) =>
        new { s.Level, s.TitleVi, s.Icon, s.Situation, s.AiRole, s.GoalVi, s.Opening, s.KeyPhrases, s.Published };

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : WhiteSpace().Replace(s.Trim(), " ");

    private sealed class DraftReply
    {
        public List<DraftScenario> Scenarios { get; set; } = [];
    }

    private sealed class DraftScenario
    {
        public string? TitleVi { get; set; }
        public string? Icon { get; set; }
        public string? Situation { get; set; }
        public string? AiRole { get; set; }
        public string? GoalVi { get; set; }
        public string? Opening { get; set; }
        public List<string>? KeyPhrases { get; set; }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();
}
