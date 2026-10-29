using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Conversations;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Ai;
using FourUme.Infrastructure.Invites;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static FourUme.Infrastructure.Ai.GeminiClient;

namespace FourUme.Infrastructure.Conversations;

public sealed partial class ConversationService(
    IAppDbContext db,
    IClientClock clock,
    IActivityService activity,
    AiClient ai,
    ConversationVoice voice,
    ILogger<ConversationService> logger) : IConversationService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    /// <summary>A learner is waiting with the app open; past this the turn fails and can be sent again.</summary>
    private static readonly TimeSpan ReplyTimeout = TimeSpan.FromSeconds(45);
    private const string BusyMessage = "AI đang bận, bạn gửi lại câu này sau vài giây nhé.";

    public static async Task<ConversationConfig> LoadConfigAsync(IAppDbContext db, CancellationToken ct)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == ConversationConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new ConversationConfig() : JsonSerializer.Deserialize<ConversationConfig>(stored, Json) ?? new ConversationConfig();
    }

    public async Task<ConversationStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var config = await LoadConfigAsync(db, ct);
        try
        {
            return await BuildStatusAsync(userId, config, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Conversation status quota failed for {UserId}; applying schema heal and retrying once", userId);
            try
            {
                await ConversationSchemaHeal.ApplyAsync((AppDbContext)db, logger, ct);
                return await BuildStatusAsync(userId, config, ct);
            }
            catch (Exception retryEx) when (retryEx is not OperationCanceledException)
            {
                logger.LogError(retryEx, "Conversation status still failing for {UserId}; using legacy daily counters", userId);
                return await BuildLegacyStatusAsync(userId, config, ct);
            }
        }
    }

    public async Task<IReadOnlyList<ConversationScenarioDto>> GetScenariosAsync(CancellationToken ct = default)
    {
        var rows = await db.ConversationScenarios.AsNoTracking()
            .Where(s => s.Published)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.CreatedAt)
            .ToListAsync(ct);
        return rows.OrderBy(s => Array.IndexOf(ConversationRules.Levels, s.Level)).Select(ToDto).ToList();
    }

    public async Task<ConversationStartDto> StartAsync(Guid userId, StartConversationRequest request, CancellationToken ct = default)
    {
        var config = await LoadConfigAsync(db, ct);
        var status = await GetStatusAsync(userId, ct);
        EnsureOpen(status);
        if (status.NextSessionKind is null)
            throw new ConversationException(429, BlockedMessage(status));
        if (status.Remaining <= 0) throw new ConversationException(429, "Bạn đã dùng hết lượt đàm thoại hôm nay.");

        ConversationScenario? scenario = null;
        if (request.ScenarioId is { } id)
        {
            scenario = await db.ConversationScenarios.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id && s.Published, ct)
                       ?? throw new ConversationException(404, "Không tìm thấy tình huống này.");
        }
        var level = scenario?.Level ?? NormalizeLevel(request.Level);

        var conversation = new Conversation { UserId = userId, ScenarioId = scenario?.Id, Level = level, SessionKind = status.NextSessionKind };
        var (text, hint, suggestions) = scenario is null ? FreeTalkOpening(level) : (scenario.Opening, scenario.GoalVi, scenario.KeyPhrases.Take(3).ToList());
        var spoken = status.Voice == ConversationVoices.Azure ? await voice.ReadAsync(text, level, config, ct) : SpokenReply.Device;
        var opening = new ConversationTurn
        {
            ConversationId = conversation.Id,
            UserId = userId,
            Index = 0,
            Text = text,
            HintVi = hint,
            Suggestions = JsonSerializer.Serialize(suggestions, Json),
            LocalDate = clock.Today,
            TtsChars = spoken.Chars,
            TtsPaid = spoken.Paid,
        };
        conversation.Turns.Add(opening);
        db.Conversations.Add(conversation);
        await db.SaveChangesAsync(ct);
        return new ConversationStartDto(conversation.Id, level, scenario is null ? null : ToDto(scenario), ToDto(opening, spoken.Url), status);
    }

    public async Task<ConversationReplyDto> SendAsync(Guid userId, Guid conversationId, string text, CancellationToken ct = default)
    {
        text = WhiteSpace().Replace((text ?? "").Trim(), " ");
        if (text.Length == 0) throw new ConversationException(400, "Bạn chưa nói gì.");
        if (text.Length > ConversationRules.MaxLearnerText)
            throw new ConversationException(400, $"Câu dài quá {ConversationRules.MaxLearnerText} ký tự, bạn nói ngắn hơn nhé.");

        var config = await LoadConfigAsync(db, ct);
        var conversation = await db.Conversations.Include(c => c.Scenario).FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId, ct)
                           ?? throw new ConversationException(404, "Không tìm thấy buổi đàm thoại.");
        if (conversation.EndedAt is not null) throw new ConversationException(400, "Buổi đàm thoại này đã kết thúc.");
        var status = await GetStatusAsync(userId, ct);
        EnsureOpen(status);
        if (status.Remaining <= 0) throw new ConversationException(429, "Bạn đã dùng hết lượt đàm thoại hôm nay.");
        var sessionLimit = ConversationQuota.SessionTurnLimit(config, conversation);
        if (conversation.LearnerTurns >= sessionLimit)
            throw new ConversationException(400, "Buổi này đã đủ lượt, bạn xem tổng kết rồi bắt đầu buổi mới nhé.");

        var history = await db.ConversationTurns.AsNoTracking()
            .Where(t => t.ConversationId == conversationId)
            .OrderByDescending(t => t.Index)
            .Take(ConversationRules.HistoryTurns)
            .ToListAsync(ct);
        history.Reverse();
        var nextIndex = history.Count == 0 ? 0 : history[^1].Index + 1;

        var reply = await AskAsync(TurnInstructions(conversation), TurnPrompt(history, text), TurnSchema(), 0.7, ct);
        TurnReply parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<TurnReply>(reply.Text, Json) ?? throw new JsonException("empty");
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "AI returned invalid conversation JSON");
            throw new ConversationException(503, BusyMessage);
        }
        var answer = Clip(Clean(parsed.Reply), ConversationRules.MaxOpening * 2);
        if (answer.Length == 0) throw new ConversationException(503, BusyMessage);

        var correction = ToCorrection(parsed.Correction, text);
        var suggestions = (parsed.Suggestions ?? []).Select(Clean).Where(s => s.Length > 0).Select(s => Clip(s, 120)).Take(3).ToList();
        var hint = Clip(Clean(parsed.HintVi), 300);
        var spoken = status.Voice == ConversationVoices.Azure ? await voice.ReadAsync(answer, conversation.Level, config, ct) : SpokenReply.Device;

        var learnerTurn = new ConversationTurn
        {
            ConversationId = conversationId,
            UserId = userId,
            Index = nextIndex,
            FromLearner = true,
            Text = text,
            Correction = correction is null ? null : JsonSerializer.Serialize(correction, Json),
            LocalDate = clock.Today,
        };
        var aiTurn = new ConversationTurn
        {
            ConversationId = conversationId,
            UserId = userId,
            Index = nextIndex + 1,
            Text = answer,
            HintVi = hint.Length == 0 ? null : hint,
            Suggestions = JsonSerializer.Serialize(suggestions, Json),
            LocalDate = clock.Today,
            TtsChars = spoken.Chars,
            TtsPaid = spoken.Paid,
        };
        db.ConversationTurns.Add(learnerTurn);
        db.ConversationTurns.Add(aiTurn);
        conversation.LearnerTurns++;
        await db.SaveChangesAsync(ct);
        if (conversation.LearnerTurns == 1) await activity.RecordAsync(userId, ActivityKind.Studied, ct);

        var after = status with { UsedToday = status.UsedToday + 1, Remaining = Math.Max(0, status.Remaining - 1) };
        return new ConversationReplyDto(ToDto(learnerTurn, null), ToDto(aiTurn, spoken.Url),
            conversation.ScenarioId is not null && parsed.GoalDone,
            conversation.LearnerTurns >= sessionLimit,
            after);
    }

    public async Task<ConversationSummaryDto> EndAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        var conversation = await db.Conversations.Include(c => c.Scenario).FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId, ct)
                           ?? throw new ConversationException(404, "Không tìm thấy buổi đàm thoại.");
        if (conversation.Summary is not null)
            return JsonSerializer.Deserialize<ConversationSummaryDto>(conversation.Summary, Json)!;

        ConversationSummaryDto summary;
        if (conversation.LearnerTurns == 0)
        {
            summary = new ConversationSummaryDto(0, "Bạn chưa nói câu nào trong buổi này. Lần sau thử trả lời vài câu nhé!", [], [], 0);
        }
        else
        {
            var turns = await db.ConversationTurns.AsNoTracking()
                .Where(t => t.ConversationId == conversationId)
                .OrderBy(t => t.Index)
                .ToListAsync(ct);
            var reply = await AskAsync(SummaryInstructions(conversation), SummaryPrompt(turns), SummarySchema(), 0.3, ct);
            SummaryReply parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<SummaryReply>(reply.Text, Json) ?? throw new JsonException("empty");
            }
            catch (JsonException ex)
            {
                logger.LogWarning(ex, "AI returned invalid conversation summary JSON");
                throw new ConversationException(503, "AI chưa tổng kết được, bạn bấm lại nhé.");
            }
            var mistakes = (parsed.Mistakes ?? [])
                .Select(m => ToCorrection(m, m.Original ?? ""))
                .OfType<ConversationCorrectionDto>()
                .Take(5)
                .ToList();
            var phrases = (parsed.Phrases ?? [])
                .Select(p => new ConversationPhraseDto(Clip(Clean(p.En), 120), Clip(Clean(p.Vi), 160)))
                .Where(p => p.En.Length > 0)
                .Take(5)
                .ToList();
            summary = new ConversationSummaryDto((int)Math.Round(Math.Clamp(parsed.Score, 0, 100)), Clip(Clean(parsed.FeedbackVi), 600), mistakes, phrases,
                conversation.LearnerTurns);
        }

        conversation.EndedAt = DateTimeOffset.UtcNow;
        conversation.Score = summary.Score;
        conversation.Summary = JsonSerializer.Serialize(summary, Json);
        await db.SaveChangesAsync(ct);
        return summary;
    }

    private async Task<ConversationStatusDto> BuildStatusAsync(Guid userId, ConversationConfig config, CancellationToken ct)
    {
        var access = await GetAccessSafeAsync(userId, ct);
        var quota = await ConversationQuota.ComputeAsync(db, clock, userId, config, access, ct);
        var on = config.Enabled && ai.Configured;
        var remaining = on ? Math.Max(0, quota.TurnAllowanceToday - quota.TurnsUsedToday) : 0;
        var azure = false;
        if (access.Premium && on)
        {
            try
            {
                azure = await voice.AvailableAsync(config, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Conversation Azure voice budget check failed");
            }
        }
        return new ConversationStatusDto(
            config.Enabled,
            ai.Configured,
            access.Premium,
            quota.TurnAllowanceToday,
            quota.TurnsUsedToday,
            remaining,
            config.FreeDailyTurns,
            config.PremiumDailyTurns,
            config.MaxTurnsPerSession,
            azure ? ConversationVoices.Azure : ConversationVoices.Device,
            quota.SessionsAllowedToday,
            quota.SessionsUsedToday,
            quota.TurnsPerSession,
            quota.NextSessionKind,
            quota.BlockedReason,
            access.ConversationAddon,
            access.ConversationAddonUntil,
            config.PremiumSessionsPerDay,
            config.PremiumTurnsPerSession,
            config.AddonSessionsPerDay,
            config.AddonTurnsPerSession,
            config.AddonDailyTurnCap);
    }

    /// <summary>Daily turn counters only — no session-bucket queries on Conversations (safe when quota SQL fails).</summary>
    private async Task<ConversationStatusDto> BuildLegacyStatusAsync(Guid userId, ConversationConfig config, CancellationToken ct)
    {
        var access = await GetAccessSafeAsync(userId, ct);
        var today = clock.Today;
        var used = await db.ConversationTurns.CountAsync(t => t.UserId == userId && t.LocalDate == today && t.FromLearner, ct);
        var premium = access.Premium;
        var limit = premium ? config.PremiumDailyTurns : config.FreeDailyTurns;
        var on = config.Enabled && ai.Configured;
        var remaining = on ? Math.Max(0, limit - used) : 0;
        string? nextKind = null;
        string? blocked = null;
        if (remaining > 0)
            nextKind = premium ? ConversationSessionKinds.Premium : ConversationSessionKinds.First;
        else
            blocked = premium ? ConversationBlockedReasons.NoSessionsLeft : ConversationBlockedReasons.NeedPremium;

        return new ConversationStatusDto(
            config.Enabled,
            ai.Configured,
            premium,
            limit,
            used,
            remaining,
            config.FreeDailyTurns,
            config.PremiumDailyTurns,
            config.MaxTurnsPerSession,
            ConversationVoices.Device,
            remaining > 0 ? 1 : 0,
            0,
            config.MaxTurnsPerSession,
            nextKind,
            blocked,
            access.ConversationAddon,
            access.ConversationAddonUntil,
            config.PremiumSessionsPerDay,
            config.PremiumTurnsPerSession,
            config.AddonSessionsPerDay,
            config.AddonTurnsPerSession,
            config.AddonDailyTurnCap);
    }

    private async Task<AccessDto> GetAccessSafeAsync(Guid userId, CancellationToken ct)
    {
        try
        {
            return await Entitlements.GetAsync(db, userId, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Entitlements read failed for {UserId}; treating as free", userId);
            return new AccessDto(false, null, null, []);
        }
    }

    private static string BlockedMessage(ConversationStatusDto status) => status.BlockedReason switch
    {
        ConversationBlockedReasons.NeedPremium => "Đàm thoại AI nằm trong Premium (1 buổi/ngày). Xem quyền lợi Premium nhé.",
        ConversationBlockedReasons.NoSessionsLeft when status.Premium && !status.ConversationAddon =>
            "Bạn đã dùng buổi Premium hôm nay. Ngày mai có thêm 1 buổi. Cần học thêm? Xem Mở rộng đàm thoại.",
        _ => "Bạn đã dùng hết buổi đàm thoại hôm nay.",
    };

    private static void EnsureOpen(ConversationStatusDto status)
    {
        if (!status.Enabled) throw new ConversationException(503, "Đàm thoại với AI đang tạm tắt.");
        if (!status.Available) throw new ConversationException(503, "Đàm thoại với AI chưa sẵn sàng, bạn quay lại sau nhé.");
    }

    private async Task<AiReply> AskAsync(string instructions, string prompt, JsonObject schema, double temperature, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(ReplyTimeout);
        try
        {
            return await ai.ChatJsonAsync(instructions, prompt, schema, temperature, timeout.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ConversationException(503, BusyMessage);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning("Conversation AI failed: {Message}", ex.Message);
            throw new ConversationException(503, BusyMessage);
        }
    }

    private static string NormalizeLevel(string? level)
    {
        var l = (level ?? "").Trim().ToUpperInvariant();
        return ConversationRules.Levels.Contains(l) ? l : "A1";
    }

    private static (string Text, string HintVi, List<string> Suggestions) FreeTalkOpening(string level) => level switch
    {
        "A1" => ("Hi! I'm your English partner. How are you today?",
            "Hãy chào lại và nói bạn khoẻ không.", ["I'm fine, thank you.", "I'm good. And you?", "I'm a little tired today."]),
        "A2" => ("Hi there! Nice to meet you. What did you do today?",
            "Kể ngắn gọn hôm nay bạn đã làm gì.", ["I went to work today.", "I stayed at home and cooked.", "I studied English this morning."]),
        "B1" => ("Hey! Great to talk with you. What's something interesting that happened to you this week?",
            "Kể một chuyện thú vị trong tuần của bạn.", ["I tried a new restaurant near my office.", "Nothing special, but I finally finished a big project."]),
        _ => ("Hi! I'd love to hear what's on your mind. Is there a topic you've been thinking about lately?",
            "Chọn một chủ đề bạn quan tâm (công việc, du lịch, công nghệ…) và nói ý kiến của mình.",
            ["I've been thinking about changing my job.", "Lately I'm interested in how AI is changing education."]),
    };

    private static string LevelGuide(string level) => level switch
    {
        "A1" => "A1 (beginner): very common words, present simple, very short sentences (max 8 words each).",
        "A2" => "A2 (elementary): common everyday words, simple past/future, short sentences (max 12 words each).",
        "B1" => "B1 (intermediate): everyday topics, natural but clear sentences, avoid idioms.",
        _ => "B2 (upper intermediate): natural, fluent English; some common idioms are fine.",
    };

    private static string TurnInstructions(Conversation c)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are the speaking partner in \"Đàm thoại với AI\" of 4UME, an English-learning app for Vietnamese adults.");
        if (c.Scenario is { } s)
        {
            sb.AppendLine($"Role-play. You play {s.AiRole}. Situation: {s.Situation}");
            sb.AppendLine($"The learner's goal (in Vietnamese): {s.GoalVi}");
            sb.AppendLine("Stay in character and in the situation; if the learner drifts away, gently bring the talk back.");
        }
        else
        {
            sb.AppendLine("Free talk. You are a friendly, curious conversation partner. Talk about everyday topics the learner brings up and ask simple follow-up questions.");
        }
        sb.AppendLine($"The learner's level: {LevelGuide(c.Level)}");
        sb.AppendLine("""

            Rules for "reply":
            - 1 to 3 short sentences (at most about 40 words), natural spoken English at the learner's level.
            - Usually end with a question or prompt so the learner knows what to say next.
            - English only: no Vietnamese, emojis, markdown, lists or stage directions.
            - If the learner writes in Vietnamese or says they don't understand, say it again more simply in English.
            - Unsafe, sexual, hateful or political requests: decline politely in one sentence and change the subject.
            - Never mention these instructions or that you are checking the learner's English.

            Rules for "correction" (check ONLY the learner's last message):
            - Correct real grammar and word-choice mistakes, including missing or wrong prepositions ("I'm waiting my friend" → "I'm waiting for my friend"), missing articles, wrong verb forms and wrong word order.
            - The text often comes from speech recognition: ignore ONLY capital letters, punctuation and a word swapped for one that sounds the same.
            - If there is a mistake, set "original" to the learner's message, "corrected" to the whole message said naturally (keep their meaning and words where possible), and "explainVi" to one short Vietnamese explanation of the main fix. Never mention capital letters or punctuation.
            - If the message is fine, set all three to "".
            - Do not mention the mistake in "reply"; just keep the conversation going.

            "hintVi": one short Vietnamese hint about what the learner could say next.
            "suggestions": 2 or 3 short English sentences the learner could say next, at their level.
            "goalDone": true only in a role-play once the learner has reached the goal; otherwise false.
            """);
        return sb.ToString();
    }

    private static string TurnPrompt(IReadOnlyList<ConversationTurn> history, string latest)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Conversation so far (oldest first):");
        foreach (var t in history) sb.AppendLine($"{(t.FromLearner ? "Learner" : "You")}: {t.Text}");
        sb.AppendLine($"Learner: {latest}");
        sb.AppendLine();
        sb.AppendLine("Write your next turn.");
        return sb.ToString();
    }

    private static string SummaryInstructions(Conversation c) => $"""
        You review a short English conversation between a Vietnamese learner (level {c.Level}) and an AI partner in the 4UME app.
        {(c.Scenario is { } s ? $"It was a role-play: {s.Situation} The learner's goal: {s.GoalVi}" : "It was free talk.")}
        The learner's messages often come from speech recognition: capital letters and punctuation mean nothing, never mention them anywhere.
        Lines marked "(shown fix: …)" were already corrected for the learner during the talk; keep those fixes consistent.

        - "score": 0 to 100 for how well the learner communicated at their level (getting the meaning across, grammar, word choice{(c.Scenario is null ? "" : ", reaching the goal")}). Be encouraging but honest.
        - "feedbackVi": 2 or 3 warm Vietnamese sentences: what went well and the one thing to work on next.
        - "mistakes": up to 5 of the learner's most useful grammar or word-choice mistakes: "original" (their sentence), "corrected" (natural sentence), "explainVi" (one short Vietnamese explanation). Empty list if there were none.
        - "phrases": 3 to 5 useful English phrases for this kind of conversation, at the learner's level, with "vi" meanings.
        """;

    private static string SummaryPrompt(IReadOnlyList<ConversationTurn> turns)
    {
        var sb = new StringBuilder();
        sb.AppendLine("The conversation:");
        foreach (var t in turns)
        {
            var fix = t.Correction is null ? null : JsonSerializer.Deserialize<ConversationCorrectionDto>(t.Correction, Json)?.Corrected;
            sb.AppendLine($"{(t.FromLearner ? "Learner" : "AI")}: {t.Text}{(fix is null ? "" : $" (shown fix: {fix})")}");
        }
        return sb.ToString();
    }

    private static JsonObject CorrectionSchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject { ["original"] = Str(), ["corrected"] = Str(), ["explainVi"] = Str() },
        ["required"] = Names("original", "corrected", "explainVi"),
    };

    private static JsonObject TurnSchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["reply"] = Str(),
            ["correction"] = CorrectionSchema(),
            ["hintVi"] = Str(),
            ["suggestions"] = new JsonObject { ["type"] = "ARRAY", ["items"] = Str() },
            ["goalDone"] = new JsonObject { ["type"] = "BOOLEAN" },
        },
        ["required"] = Names("reply", "correction", "hintVi", "suggestions", "goalDone"),
    };

    private static JsonObject SummarySchema() => new()
    {
        ["type"] = "OBJECT",
        ["properties"] = new JsonObject
        {
            ["score"] = new JsonObject { ["type"] = "INTEGER" },
            ["feedbackVi"] = Str(),
            ["mistakes"] = new JsonObject { ["type"] = "ARRAY", ["items"] = CorrectionSchema() },
            ["phrases"] = new JsonObject
            {
                ["type"] = "ARRAY",
                ["items"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject { ["en"] = Str(), ["vi"] = Str() },
                    ["required"] = Names("en", "vi"),
                },
            },
        },
        ["required"] = Names("score", "feedbackVi", "mistakes", "phrases"),
    };

    /// <summary>Null when the AI found nothing to fix (or "corrected" only differs in case and punctuation).</summary>
    private static ConversationCorrectionDto? ToCorrection(CorrectionReply? c, string said)
    {
        if (c is null) return null;
        var corrected = Clip(Clean(c.Corrected), 300);
        var original = Clip(Clean(c.Original), 300);
        if (original.Length == 0) original = said;
        if (corrected.Length == 0 || Plain(corrected) == Plain(original)) return null;
        return new ConversationCorrectionDto(original, corrected, Clip(Clean(c.ExplainVi), 300));
    }

    private static string Plain(string s) => new string(s.ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch) || ch == ' ').ToArray()).Trim();

    private static string Clean(string? s) => string.IsNullOrWhiteSpace(s) ? "" : WhiteSpace().Replace(s.Trim(), " ");

    private static string Clip(string s, int max) => s.Length <= max ? s : s[..max].TrimEnd();

    private static ConversationScenarioDto ToDto(ConversationScenario s) =>
        new(s.Id, s.Level, s.TitleVi, s.Icon, s.GoalVi, s.AiRole, s.KeyPhrases);

    private static ConversationTurnDto ToDto(ConversationTurn t, string? audioUrl) => new(
        t.Id,
        t.FromLearner,
        t.Text,
        t.Correction is null ? null : JsonSerializer.Deserialize<ConversationCorrectionDto>(t.Correction, Json),
        t.HintVi,
        t.Suggestions is null ? [] : JsonSerializer.Deserialize<List<string>>(t.Suggestions, Json) ?? [],
        audioUrl);

    private sealed class TurnReply
    {
        public string? Reply { get; set; }
        public CorrectionReply? Correction { get; set; }
        public string? HintVi { get; set; }
        public List<string>? Suggestions { get; set; }
        public bool GoalDone { get; set; }
    }

    private sealed class CorrectionReply
    {
        public string? Original { get; set; }
        public string? Corrected { get; set; }
        public string? ExplainVi { get; set; }
    }

    private sealed class SummaryReply
    {
        /// <summary>Some models write 85.0.</summary>
        public double Score { get; set; }
        public string? FeedbackVi { get; set; }
        public List<CorrectionReply>? Mistakes { get; set; }
        public List<PhraseReply>? Phrases { get; set; }
    }

    private sealed class PhraseReply
    {
        public string? En { get; set; }
        public string? Vi { get; set; }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpace();
}
