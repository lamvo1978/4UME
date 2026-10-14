using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Practice;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Practice;

public class PracticeService(IAppDbContext db, IClientClock clock, IActivityService activity) : IPracticeService
{
    public async Task<PracticeOverviewDto> GetOverviewAsync(CancellationToken ct = default)
    {
        var counts = await db.PracticeSentences.AsNoTracking()
            .Where(s => s.Published)
            .GroupBy(s => s.Level)
            .Select(g => new { Level = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Level, x => x.Count, ct);
        return new PracticeOverviewDto(PracticeRules.Levels.Select(l => new PracticeLevelDto(l, counts.GetValueOrDefault(l))).ToList());
    }

    public async Task<IReadOnlyList<PracticeSentenceDto>> GetRoundAsync(string level, int count, CancellationToken ct = default)
    {
        level = (level ?? "").Trim().ToUpperInvariant();
        if (!PracticeRules.Levels.Contains(level)) return [];
        return await db.PracticeSentences.AsNoTracking()
            .Where(s => s.Published && s.Level == level)
            .OrderBy(_ => EF.Functions.Random())
            .Take(Math.Clamp(count, 1, PracticeRules.MaxRound))
            .Select(s => new PracticeSentenceDto(s.Id, s.Level, s.Topic, s.En, s.Vi, s.AudioText == s.En ? s.AudioUrl : null))
            .ToListAsync(ct);
    }

    public async Task RecordAsync(Guid userId, CancellationToken ct = default)
    {
        db.ListeningLogs.Add(new ListeningLog { UserId = userId, LocalDate = clock.Today, LessonSlug = PracticeRules.LogSlug, Kind = ListeningLogKind.Sentence });
        await db.SaveChangesAsync(ct);
        await activity.RecordAsync(userId, ActivityKind.Listening, ct);
    }
}
