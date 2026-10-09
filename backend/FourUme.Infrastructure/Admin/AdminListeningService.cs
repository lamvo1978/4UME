using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Listening;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminListeningService(IAppDbContext db, Auditor auditor, ListeningAudioJobs jobs, AzureSpeechClient speech) : IAdminListeningService
{
    private const string PreviewText = "Hi there! This is how I sound in the 4UME listening corner.";

    private sealed record Stats(int Listeners, int Completions, int Likes);

    public async Task<IReadOnlyList<AdminListeningSummaryDto>> GetLessonsAsync(CancellationToken ct = default)
    {
        var lessons = await db.ListeningLessons.AsNoTracking().OrderBy(l => l.SortOrder).ThenBy(l => l.Slug).ToListAsync(ct);
        var stats = await StatsAsync(null, ct);
        return lessons.Select(l =>
        {
            var doc = ListeningRules.ToDocument(l);
            var s = stats.GetValueOrDefault(l.Slug) ?? new Stats(0, 0, 0);
            return new AdminListeningSummaryDto(l.Slug, l.TitleEn, l.TitleVi, l.Kind, l.Level, l.Topic, l.SortOrder, l.Published,
                doc.Lines.Count, ListeningRules.CharCount(doc), l.DurationMs, Audio(l, doc).State,
                s.Listeners, s.Completions, s.Likes, l.Version, l.UpdatedAt, l.EditedAt);
        }).ToList();
    }

    public async Task<AdminListeningDetailDto?> GetLessonAsync(string slug, CancellationToken ct = default)
    {
        var lesson = await db.ListeningLessons.AsNoTracking().FirstOrDefaultAsync(l => l.Slug == slug, ct);
        if (lesson is null) return null;
        var s = (await StatsAsync(slug, ct)).GetValueOrDefault(slug) ?? new Stats(0, 0, 0);
        var doc = ListeningRules.ToDocument(lesson);
        return new AdminListeningDetailDto(doc, Audio(lesson, doc), ListeningRules.CharCount(doc),
            s.Listeners, s.Completions, s.Likes, lesson.UpdatedAt, lesson.EditedAt, ListeningRules.Validate(doc));
    }

    public async Task<AdminListeningDetailDto> CreateLessonAsync(ListeningLessonDocument doc, CancellationToken ct = default)
    {
        doc = ListeningRules.Normalize(doc);
        doc.Version = 1;
        EnsureSavable(doc);
        if (await db.ListeningLessons.AnyAsync(l => l.Slug == doc.Slug, ct))
            throw new ContentConflictException($"Đã có bài với mã \"{doc.Slug}\".");

        var lesson = await AddAsync(doc, ct);
        auditor.Record(AuditEntities.Listening, lesson.Slug, AuditActions.Create, lesson.TitleVi, null, ListeningRules.ToDocument(lesson));
        await db.SaveChangesAsync(ct);
        return (await GetLessonAsync(lesson.Slug, ct))!;
    }

    public async Task<AdminListeningDetailDto> UpdateLessonAsync(string slug, ListeningLessonDocument doc, CancellationToken ct = default)
    {
        var lesson = await db.ListeningLessons.FirstOrDefaultAsync(l => l.Slug == slug, ct) ?? throw new KeyNotFoundException();
        doc = ListeningRules.Normalize(doc);
        doc.Slug = slug;
        doc.Version = lesson.Version + 1;
        doc.Order = lesson.SortOrder;
        EnsureSavable(doc);
        var before = ListeningRules.ToDocument(lesson);
        Apply(lesson, doc);
        auditor.Record(AuditEntities.Listening, slug, AuditActions.Update, lesson.TitleVi, before, ListeningRules.ToDocument(lesson));
        await db.SaveChangesAsync(ct);
        return (await GetLessonAsync(slug, ct))!;
    }

    public async Task DeleteLessonAsync(string slug, CancellationToken ct = default)
    {
        var lesson = await db.ListeningLessons.FirstOrDefaultAsync(l => l.Slug == slug, ct) ?? throw new KeyNotFoundException();
        if (jobs.Get(slug)?.Running == true) throw new ContentConflictException("Bài đang được tạo âm thanh, hãy đợi xong rồi xoá.");
        var listeners = await db.ListeningProgresses.CountAsync(p => p.LessonSlug == slug, ct);
        if (listeners > 0)
            throw new ContentConflictException($"Đã có {listeners} người nghe bài này. Hãy ẩn bài thay vì xoá để giữ tiến độ của họ.");
        db.ListeningLessons.Remove(lesson);
        auditor.Record(AuditEntities.Listening, slug, AuditActions.Delete, lesson.TitleVi, ListeningRules.ToDocument(lesson), null);
        await db.SaveChangesAsync(ct);
        jobs.DeleteAudio(lesson.AudioUrl);
    }

    public async Task RestoreLessonAsync(ListeningLessonDocument doc, CancellationToken ct = default)
    {
        doc = ListeningRules.Normalize(doc);
        var lesson = await db.ListeningLessons.FirstOrDefaultAsync(l => l.Slug == doc.Slug, ct);
        var before = lesson is null ? null : ListeningRules.ToDocument(lesson);
        doc.Version = (lesson?.Version ?? 0) + 1;
        EnsureSavable(doc);
        if (lesson is null) lesson = await AddAsync(doc, ct);
        else
        {
            doc.Order = lesson.SortOrder;
            Apply(lesson, doc);
        }
        auditor.Record(AuditEntities.Listening, lesson.Slug, AuditActions.Restore, lesson.TitleVi, before, ListeningRules.ToDocument(lesson));
        await db.SaveChangesAsync(ct);
    }

    public async Task ReorderLessonsAsync(ReorderRequest request, CancellationToken ct = default)
    {
        var lessons = await db.ListeningLessons.ToDictionaryAsync(l => l.Slug, ct);
        var order = 1;
        var now = DateTimeOffset.UtcNow;
        foreach (var slug in request.Ids.Distinct())
        {
            if (!lessons.TryGetValue(slug, out var lesson)) continue;
            if (lesson.SortOrder != order)
            {
                lesson.SortOrder = order;
                lesson.EditedAt = now;
            }
            order++;
        }
        foreach (var lesson in lessons.Values.Where(l => !request.Ids.Contains(l.Slug)).OrderBy(l => l.SortOrder))
            lesson.SortOrder = order++;
        auditor.Record(AuditEntities.Listening, "*", AuditActions.Reorder, "Đổi thứ tự bài nghe", null, null);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ListeningLessonDocument>> ExportLessonsAsync(CancellationToken ct = default) =>
        (await db.ListeningLessons.AsNoTracking().OrderBy(l => l.SortOrder).ThenBy(l => l.Slug).ToListAsync(ct))
            .Select(ListeningRules.ToDocument).ToList();

    public async Task<ImportListeningResult> ImportLessonsAsync(ImportListeningRequest request, CancellationToken ct = default)
    {
        if (request.Lessons.Count == 0) throw new InvalidOperationException("File không có bài nào.");
        var existing = await db.ListeningLessons.ToDictionaryAsync(l => l.Slug, ct);
        var seen = new HashSet<string>();
        var rows = new List<ImportListeningRowResult>();
        var plans = new List<ListeningLessonDocument>();

        foreach (var raw in request.Lessons)
        {
            var doc = ListeningRules.Normalize(raw);
            // Versions are assigned on save, so files without one are fine.
            if (doc.Version < 1) doc.Version = 1;
            var problems = (doc.Published == false ? ListeningRules.ValidateBasics(doc) : ListeningRules.Validate(doc)).ToList();
            if (doc.Slug.Length > 0 && !seen.Add(doc.Slug)) problems.Insert(0, "Mã bài bị lặp trong file.");
            existing.TryGetValue(doc.Slug, out var current);

            string status;
            if (problems.Count > 0) status = ImportStatus.Error;
            else if (current is null) status = ImportStatus.Create;
            else if (Fingerprint(ListeningRules.ToDocument(current)) == Fingerprint(doc)) status = ImportStatus.Unchanged;
            else status = ImportStatus.Update;

            if (status is ImportStatus.Create or ImportStatus.Update) plans.Add(doc);
            rows.Add(new ImportListeningRowResult(doc.Slug, doc.TitleEn, status, current?.Version, problems));
        }

        var committed = false;
        if (request.Commit && plans.Count > 0)
        {
            foreach (var doc in plans)
            {
                if (existing.TryGetValue(doc.Slug, out var lesson))
                {
                    var before = ListeningRules.ToDocument(lesson);
                    doc.Version = lesson.Version + 1;
                    doc.Order = lesson.SortOrder;
                    Apply(lesson, doc);
                    auditor.Record(AuditEntities.Listening, doc.Slug, AuditActions.Import, lesson.TitleVi, before, ListeningRules.ToDocument(lesson));
                }
                else
                {
                    doc.Version = 1;
                    lesson = await AddAsync(doc, ct);
                    existing[doc.Slug] = lesson;
                    auditor.Record(AuditEntities.Listening, doc.Slug, AuditActions.Import, lesson.TitleVi, null, ListeningRules.ToDocument(lesson));
                }
            }
            await db.SaveChangesAsync(ct);
            committed = true;
        }

        return new ImportListeningResult(
            rows.Count(r => r.Status == ImportStatus.Create),
            rows.Count(r => r.Status == ImportStatus.Update),
            rows.Count(r => r.Status == ImportStatus.Unchanged),
            rows.Count(r => r.Status == ImportStatus.Error),
            committed,
            rows);
    }

    public async Task<AdminListeningAudioDto> GenerateAudioAsync(string slug, CancellationToken ct = default)
    {
        if (!speech.Options.Configured)
            throw new InvalidOperationException("Chưa cấu hình Azure Speech trên máy chủ (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).");
        var lesson = await db.ListeningLessons.FirstOrDefaultAsync(l => l.Slug == slug, ct) ?? throw new KeyNotFoundException();
        var doc = ListeningRules.ToDocument(lesson);
        var problems = ListeningRules.Validate(doc);
        if (problems.Count > 0)
            throw new InvalidOperationException("Hãy sửa bài cho hợp lệ trước khi tạo âm thanh. " + string.Join(" ", problems.Take(3)));

        var usage = await jobs.GetUsageAsync(db, ct);
        var needed = doc.Lines.Sum(l => AzureSpeechClient.BilledChars(l.En));
        if (usage.Chars + needed > speech.Options.MonthlyCharLimit)
            throw new InvalidOperationException(
                $"Tháng này đã dùng khoảng {usage.Chars:N0}/{speech.Options.MonthlyCharLimit:N0} ký tự; bài này cần khoảng {needed:N0}. Hãy đợi sang tháng.");

        jobs.Start(doc);
        auditor.Record(AuditEntities.Listening, slug, AuditActions.Generate, $"Tạo âm thanh: {lesson.TitleVi}", null, null);
        await db.SaveChangesAsync(ct);
        return Audio(lesson, doc);
    }

    public async Task<SpeechStatusDto> GetSpeechStatusAsync(CancellationToken ct = default)
    {
        var o = speech.Options;
        var usage = await jobs.GetUsageAsync(db, ct);
        return new SpeechStatusDto(o.Configured, o.Configured ? o.Region!.Trim() : null, ListeningRules.Voices,
            usage.Month, usage.Chars, o.MonthlyCharLimit);
    }

    public async Task<byte[]> PreviewVoiceAsync(VoicePreviewRequest request, CancellationToken ct = default)
    {
        if (!ListeningRules.Voices.Any(v => v.Name == request.Voice)) throw new InvalidOperationException("Giọng không hợp lệ.");
        var text = string.IsNullOrWhiteSpace(request.Text) ? PreviewText : request.Text.Trim();
        if (text.Length > ListeningRules.MaxLineChars) text = text[..ListeningRules.MaxLineChars];
        var audio = await speech.SynthesizeAsync(request.Voice, text, ListeningRules.SpeakingRate(request.Level ?? "B1"), ct);
        await jobs.AddUsageAsync(AzureSpeechClient.BilledChars(text));
        return audio;
    }

    private AdminListeningAudioDto Audio(ListeningLesson lesson, ListeningLessonDocument doc)
    {
        var job = jobs.Get(lesson.Slug);
        var current = ListeningRules.AudioIsCurrent(lesson, doc);
        var state = job switch
        {
            { Running: true } => ListeningAudioStates.Running,
            { Error: not null } => ListeningAudioStates.Failed,
            _ when lesson.AudioUrl is null => ListeningAudioStates.None,
            _ => current ? ListeningAudioStates.Ready : ListeningAudioStates.Stale,
        };
        var timings = current ? ListeningRules.ReadTimings(lesson) : null;
        return new AdminListeningAudioDto(state, lesson.AudioUrl, lesson.DurationMs, timings,
            job?.Done ?? 0, job?.Total ?? doc.Lines.Count, job?.Error);
    }

    /// <summary>Adds a new piece at the end of the list (not saved yet).</summary>
    private async Task<ListeningLesson> AddAsync(ListeningLessonDocument doc, CancellationToken ct)
    {
        var maxOrder = await db.ListeningLessons.Select(l => (int?)l.SortOrder).MaxAsync(ct) ?? 0;
        var maxTracked = db.ListeningLessons.Local.Select(l => l.SortOrder).DefaultIfEmpty(0).Max();
        doc.Order = Math.Max(maxOrder, maxTracked) + 1;
        var lesson = new ListeningLesson { Slug = doc.Slug };
        Apply(lesson, doc);
        db.ListeningLessons.Add(lesson);
        return lesson;
    }

    private static void Apply(ListeningLesson lesson, ListeningLessonDocument doc)
    {
        ListeningRules.Apply(doc, lesson);
        lesson.EditedAt = lesson.UpdatedAt;
    }

    /// <summary>Content comparison that ignores version and order.</summary>
    private static string Fingerprint(ListeningLessonDocument doc) => JsonSerializer.Serialize(new
    {
        doc.TitleEn,
        doc.TitleVi,
        doc.Kind,
        doc.Level,
        doc.Topic,
        doc.SummaryVi,
        Published = doc.Published ?? true,
        doc.Speakers,
        doc.Lines,
    }, GrammarJson.Options);

    /// <summary>Hidden pieces may be saved as drafts; published ones must pass every check the app relies on.</summary>
    private static void EnsureSavable(ListeningLessonDocument doc)
    {
        var problems = doc.Published == false ? ListeningRules.ValidateBasics(doc) : ListeningRules.Validate(doc);
        if (problems.Count > 0)
            throw new InvalidOperationException(
                (doc.Published == false ? "" : "Bài đang hiện nên phải hợp lệ (hoặc tắt Hiện trong app để lưu nháp). ")
                + string.Join(" ", problems.Take(5)) + (problems.Count > 5 ? $" … và {problems.Count - 5} lỗi khác." : ""));
    }

    private async Task<Dictionary<string, Stats>> StatsAsync(string? slug, CancellationToken ct)
    {
        var progress = db.ListeningProgresses.AsNoTracking();
        if (slug is not null) progress = progress.Where(p => p.LessonSlug == slug);
        return await progress.GroupBy(p => p.LessonSlug)
            .Select(g => new { Slug = g.Key, Listeners = g.Count(), Completions = g.Sum(p => p.TimesCompleted), Likes = g.Count(p => p.Liked) })
            .ToDictionaryAsync(x => x.Slug, x => new Stats(x.Listeners, x.Completions, x.Likes), ct);
    }
}
