using System.Text.Json;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Listening;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Listening;

public class ListeningService(IAppDbContext db, IActivityService activity) : IListeningService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly ListeningProgressDto NoProgress = new(0, false, 0, false);

    public async Task<IReadOnlyList<ListeningSummaryDto>> GetLessonsAsync(Guid userId, CancellationToken ct = default)
    {
        var lessons = await db.ListeningLessons.AsNoTracking()
            .Where(l => l.Published)
            .OrderBy(l => l.SortOrder).ThenBy(l => l.Slug)
            .ToListAsync(ct);
        var progress = await db.ListeningProgresses.AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.LessonSlug, ct);

        return lessons.Select(l =>
        {
            var doc = ListeningRules.ToDocument(l);
            var hasAudio = ListeningRules.AudioIsCurrent(l, doc);
            return new ListeningSummaryDto(l.Slug, l.TitleEn, l.TitleVi, l.Kind, l.Level, l.Topic, l.SummaryVi,
                doc.Lines.Count, hasAudio, hasAudio ? l.DurationMs : null,
                progress.TryGetValue(l.Slug, out var p) ? ToDto(p) : NoProgress);
        }).ToList();
    }

    public async Task<ListeningDetailDto?> GetLessonAsync(Guid userId, string slug, CancellationToken ct = default)
    {
        var lesson = await db.ListeningLessons.AsNoTracking().FirstOrDefaultAsync(l => l.Slug == slug && l.Published, ct);
        if (lesson is null) return null;
        var progress = await db.ListeningProgresses.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonSlug == slug, ct);

        var doc = ListeningRules.ToDocument(lesson);
        var hasAudio = ListeningRules.AudioIsCurrent(lesson, doc);
        var timings = hasAudio ? ListeningRules.ReadTimings(lesson) : null;
        if (timings is not null && timings.Count != doc.Lines.Count) timings = null;

        return new ListeningDetailDto(lesson.Slug, lesson.TitleEn, lesson.TitleVi, lesson.Kind, lesson.Level, lesson.Topic,
            lesson.SummaryVi,
            hasAudio ? lesson.AudioUrl : null,
            hasAudio ? lesson.DurationMs : null,
            doc.Speakers.Select(s => new ListeningSpeakerDto(s.Key, s.Name)).ToList(),
            doc.Lines.Select((x, i) => new ListeningLineDto(x.Speaker, x.En, x.Vi, timings?[i][0], timings?[i][1])).ToList(),
            progress is null ? NoProgress : ToDto(progress));
    }

    public async Task<ListeningProgressDto?> UpdateProgressAsync(Guid userId, string slug, UpdateListeningProgressRequest request, CancellationToken ct = default)
    {
        if (!await db.ListeningLessons.AnyAsync(l => l.Slug == slug && l.Published, ct)) return null;

        var progress = await db.ListeningProgresses.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonSlug == slug, ct);
        if (progress is null)
        {
            progress = new ListeningProgress { UserId = userId, LessonSlug = slug };
            db.ListeningProgresses.Add(progress);
        }

        if (request.PositionMs is { } position) progress.PositionMs = Math.Max(0, position);
        if (request.Liked is { } liked) progress.Liked = liked;
        var finished = request.Completed == true;
        if (finished)
        {
            progress.CompletedAt ??= DateTimeOffset.UtcNow;
            progress.TimesCompleted++;
            progress.PositionMs = 0;
        }
        progress.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        if (finished && (await GetConfigAsync(ct)).CountsTowardStreak)
            await activity.RecordAsync(userId, ActivityKind.Listening, ct);
        return ToDto(progress);
    }

    public async Task<ListeningConfig> GetConfigAsync(CancellationToken ct = default)
    {
        var stored = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == ListeningConfig.SettingKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);
        return stored is null ? new ListeningConfig() : JsonSerializer.Deserialize<ListeningConfig>(stored, Json) ?? new ListeningConfig();
    }

    private static ListeningProgressDto ToDto(ListeningProgress p) =>
        new(p.PositionMs, p.CompletedAt is not null, p.TimesCompleted, p.Liked);
}
