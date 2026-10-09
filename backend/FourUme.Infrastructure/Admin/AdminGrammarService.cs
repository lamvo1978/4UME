using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public class AdminGrammarService(IAppDbContext db, Auditor auditor) : IAdminGrammarService
{
    public async Task<IReadOnlyList<AdminGrammarSummaryDto>> GetLessonsAsync(CancellationToken ct = default)
    {
        var lessons = await db.GrammarLessons.AsNoTracking().OrderBy(l => l.SortOrder).ThenBy(l => l.Slug).ToListAsync(ct);
        var learners = await LearnersAsync(null, ct);
        return lessons.Select(l => new AdminGrammarSummaryDto(
            l.Slug, l.TitleVi, l.TitleEn, l.Level, l.SortOrder, l.Published, l.QuizSize,
            Count(l.SectionsJson), Count(l.ExercisesJson), l.Version, l.UpdatedAt, l.EditedAt,
            learners.GetValueOrDefault(l.Slug))).ToList();
    }

    public async Task<AdminGrammarDetailDto?> GetLessonAsync(string slug, CancellationToken ct = default)
    {
        var lesson = await db.GrammarLessons.AsNoTracking().FirstOrDefaultAsync(l => l.Slug == slug, ct);
        if (lesson is null) return null;
        var learners = (await LearnersAsync(slug, ct)).GetValueOrDefault(slug);
        var doc = ToDocument(lesson);
        return new AdminGrammarDetailDto(doc, learners, lesson.UpdatedAt, lesson.EditedAt, GrammarValidator.Validate(doc));
    }

    public async Task<AdminGrammarDetailDto> CreateLessonAsync(GrammarLessonDocument doc, CancellationToken ct = default)
    {
        doc.Slug = doc.Slug?.Trim().ToLowerInvariant() ?? "";
        doc.Version = 1;
        EnsureSavable(doc);
        if (await db.GrammarLessons.AnyAsync(l => l.Slug == doc.Slug, ct))
            throw new ContentConflictException($"Đã có bài với mã \"{doc.Slug}\".");

        var lesson = await AddAsync(doc, ct);
        auditor.Record(AuditEntities.Grammar, lesson.Slug, AuditActions.Create, lesson.TitleVi, null, ToDocument(lesson));
        await db.SaveChangesAsync(ct);
        return (await GetLessonAsync(lesson.Slug, ct))!;
    }

    public async Task<AdminGrammarDetailDto> UpdateLessonAsync(string slug, GrammarLessonDocument doc, CancellationToken ct = default)
    {
        var lesson = await db.GrammarLessons.FirstOrDefaultAsync(l => l.Slug == slug, ct) ?? throw new KeyNotFoundException();
        doc.Slug = slug;
        doc.Version = lesson.Version + 1;
        EnsureSavable(doc);
        var before = ToDocument(lesson);
        Apply(lesson, doc);
        auditor.Record(AuditEntities.Grammar, slug, AuditActions.Update, lesson.TitleVi, before, ToDocument(lesson));
        await db.SaveChangesAsync(ct);
        return (await GetLessonAsync(slug, ct))!;
    }

    public async Task DeleteLessonAsync(string slug, CancellationToken ct = default)
    {
        var lesson = await db.GrammarLessons.FirstOrDefaultAsync(l => l.Slug == slug, ct) ?? throw new KeyNotFoundException();
        var learners = (await LearnersAsync(slug, ct)).GetValueOrDefault(slug);
        if (learners > 0 || await db.GrammarProgresses.AnyAsync(p => p.LessonSlug == slug, ct))
            throw new ContentConflictException($"Đã có {learners} người học bài này. Hãy ẩn bài thay vì xoá để giữ kết quả của họ.");
        db.GrammarLessons.Remove(lesson);
        auditor.Record(AuditEntities.Grammar, slug, AuditActions.Delete, lesson.TitleVi, ToDocument(lesson), null);
        await db.SaveChangesAsync(ct);
    }

    public async Task RestoreLessonAsync(GrammarLessonDocument doc, CancellationToken ct = default)
    {
        doc.Slug = doc.Slug?.Trim().ToLowerInvariant() ?? "";
        var lesson = await db.GrammarLessons.FirstOrDefaultAsync(l => l.Slug == doc.Slug, ct);
        var before = lesson is null ? null : ToDocument(lesson);
        doc.Version = (lesson?.Version ?? 0) + 1;
        EnsureSavable(doc);
        if (lesson is null) lesson = await AddAsync(doc, ct);
        else Apply(lesson, doc);
        auditor.Record(AuditEntities.Grammar, lesson.Slug, AuditActions.Restore, lesson.TitleVi, before, ToDocument(lesson));
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<GrammarLessonDocument>> ExportLessonsAsync(CancellationToken ct = default) =>
        (await db.GrammarLessons.AsNoTracking().OrderBy(l => l.SortOrder).ThenBy(l => l.Slug).ToListAsync(ct))
            .Select(ToDocument).ToList();

    public async Task<ImportGrammarResult> ImportLessonsAsync(ImportGrammarRequest request, CancellationToken ct = default)
    {
        if (request.Lessons.Count == 0) throw new InvalidOperationException("File không có bài nào.");
        var existing = await db.GrammarLessons.ToDictionaryAsync(l => l.Slug, ct);
        var seen = new HashSet<string>();
        var rows = new List<ImportGrammarRowResult>();
        var plans = new List<GrammarLessonDocument>();

        foreach (var doc in request.Lessons)
        {
            doc.Slug = doc.Slug?.Trim().ToLowerInvariant() ?? "";
            // Versions are assigned on save, so files without one are fine.
            if (doc.Version < 1) doc.Version = 1;
            var problems = (doc.Published == false ? GrammarValidator.ValidateBasics(doc) : GrammarValidator.Validate(doc)).ToList();
            if (doc.Slug.Length > 0 && !seen.Add(doc.Slug)) problems.Insert(0, "Mã bài bị lặp trong file.");
            existing.TryGetValue(doc.Slug, out var current);

            string status;
            if (problems.Count > 0) status = ImportStatus.Error;
            else if (current is null) status = ImportStatus.Create;
            else if (Fingerprint(ToDocument(current)) == Fingerprint(doc)) status = ImportStatus.Unchanged;
            else status = ImportStatus.Update;

            if (status is ImportStatus.Create or ImportStatus.Update) plans.Add(doc);
            rows.Add(new ImportGrammarRowResult(doc.Slug, doc.TitleVi ?? "", status, current?.Version, problems));
        }

        var committed = false;
        if (request.Commit && plans.Count > 0)
        {
            foreach (var doc in plans)
            {
                if (existing.TryGetValue(doc.Slug, out var lesson))
                {
                    var before = ToDocument(lesson);
                    doc.Version = lesson.Version + 1;
                    Apply(lesson, doc);
                    auditor.Record(AuditEntities.Grammar, doc.Slug, AuditActions.Import, lesson.TitleVi, before, ToDocument(lesson));
                }
                else
                {
                    doc.Version = 1;
                    lesson = await AddAsync(doc, ct);
                    existing[doc.Slug] = lesson;
                    auditor.Record(AuditEntities.Grammar, doc.Slug, AuditActions.Import, lesson.TitleVi, null, ToDocument(lesson));
                }
            }
            await db.SaveChangesAsync(ct);
            committed = true;
        }

        return new ImportGrammarResult(
            rows.Count(r => r.Status == ImportStatus.Create),
            rows.Count(r => r.Status == ImportStatus.Update),
            rows.Count(r => r.Status == ImportStatus.Unchanged),
            rows.Count(r => r.Status == ImportStatus.Error),
            committed,
            rows);
    }

    /// <summary>Adds a new lesson at the end of the list (not saved yet).</summary>
    private async Task<GrammarLesson> AddAsync(GrammarLessonDocument doc, CancellationToken ct)
    {
        var maxOrder = await db.GrammarLessons.Select(l => (int?)l.SortOrder).MaxAsync(ct) ?? 0;
        var maxTracked = db.GrammarLessons.Local.Select(l => l.SortOrder).DefaultIfEmpty(0).Max();
        var lesson = new GrammarLesson { Slug = doc.Slug, SortOrder = Math.Max(maxOrder, maxTracked) + 1 };
        Apply(lesson, doc);
        db.GrammarLessons.Add(lesson);
        return lesson;
    }

    /// <summary>Content comparison that ignores version, order and default-valued fields.</summary>
    private static string Fingerprint(GrammarLessonDocument doc) => JsonSerializer.Serialize(new
    {
        TitleVi = doc.TitleVi?.Trim(),
        TitleEn = string.IsNullOrWhiteSpace(doc.TitleEn) ? null : doc.TitleEn.Trim(),
        doc.Level,
        SummaryVi = doc.SummaryVi?.Trim() ?? "",
        QuizSize = doc.QuizSize ?? 8,
        Published = doc.Published ?? true,
        doc.Sections,
        doc.Exercises,
    }, GrammarJson.Options);

    public async Task ReorderLessonsAsync(ReorderRequest request, CancellationToken ct = default)
    {
        var lessons = await db.GrammarLessons.ToDictionaryAsync(l => l.Slug, ct);
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
        auditor.Record(AuditEntities.Grammar, "*", AuditActions.Reorder, "Đổi thứ tự bài ngữ pháp", null, null);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Hidden lessons may be saved as drafts; published ones must pass every check the app relies on.</summary>
    private static void EnsureSavable(GrammarLessonDocument doc)
    {
        var problems = doc.Published == false ? GrammarValidator.ValidateBasics(doc) : GrammarValidator.Validate(doc);
        if (problems.Count > 0)
            throw new InvalidOperationException(
                (doc.Published == false ? "" : "Bài đang hiện nên phải hợp lệ (hoặc tắt Hiện trong app để lưu nháp). ")
                + string.Join(" ", problems.Take(5)) + (problems.Count > 5 ? $" … và {problems.Count - 5} lỗi khác." : ""));
    }

    private static void Apply(GrammarLesson lesson, GrammarLessonDocument doc)
    {
        lesson.Version = doc.Version;
        lesson.TitleVi = doc.TitleVi.Trim();
        lesson.TitleEn = string.IsNullOrWhiteSpace(doc.TitleEn) ? null : doc.TitleEn.Trim();
        lesson.Level = doc.Level;
        lesson.SummaryVi = doc.SummaryVi?.Trim() ?? "";
        lesson.QuizSize = doc.QuizSize ?? 8;
        lesson.Published = doc.Published ?? true;
        lesson.SectionsJson = JsonSerializer.Serialize(doc.Sections, GrammarJson.Options);
        lesson.ExercisesJson = JsonSerializer.Serialize(doc.Exercises, GrammarJson.Options);
        lesson.UpdatedAt = DateTimeOffset.UtcNow;
        lesson.EditedAt = lesson.UpdatedAt;
    }

    private static GrammarLessonDocument ToDocument(GrammarLesson l) => new()
    {
        Slug = l.Slug,
        Version = l.Version,
        TitleVi = l.TitleVi,
        TitleEn = l.TitleEn,
        Level = l.Level,
        Order = l.SortOrder,
        SummaryVi = l.SummaryVi,
        QuizSize = l.QuizSize,
        Published = l.Published,
        Sections = JsonSerializer.Deserialize<List<GrammarSection>>(l.SectionsJson, GrammarJson.Options) ?? [],
        Exercises = JsonSerializer.Deserialize<List<GrammarExercise>>(l.ExercisesJson, GrammarJson.Options) ?? [],
    };

    private async Task<Dictionary<string, int>> LearnersAsync(string? slug, CancellationToken ct)
    {
        var attempts = db.GrammarAttempts.AsNoTracking();
        if (slug is not null) attempts = attempts.Where(a => a.LessonSlug == slug);
        return await attempts.GroupBy(a => a.LessonSlug)
            .Select(g => new { Slug = g.Key, Count = g.Select(a => a.UserId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Slug, x => x.Count, ct);
    }

    private static int Count(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement.GetArrayLength() : 0;
    }
}
