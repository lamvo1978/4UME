using FourUme.Application.Abstractions;
using FourUme.Application.Auth;
using FourUme.Application.Placement;
using FourUme.Application.Review;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Placement;

public class PlacementService(IAppDbContext db, IAuthService auth) : IPlacementService
{
    private sealed record PoolWord(string Id, string Text, string Ipa, string Pos, string Level, string MeaningVi);

    public async Task<IReadOnlyList<PlacementLevelDto>> GetQuestionsAsync(CancellationToken ct = default)
    {
        var pool = await db.Words.AsNoTracking()
            .Where(w => w.Published && w.Deck.Published && PlacementRules.QuestionPos.Contains(w.Pos))
            .Select(w => new PoolWord(w.Id, w.Text, w.Ipa, w.Pos, w.Level, w.MeaningVi))
            .ToListAsync(ct);
        // Only the first sense, so a long multi-sense answer doesn't stand out among the options.
        pool = pool
            .Select(p => p with { MeaningVi = p.MeaningVi.Split([',', ';'], 2)[0].Trim() })
            .Where(p => p.MeaningVi.Length > 0)
            .ToList();

        return PlacementRules.Levels.Select(level =>
        {
            var sameLevel = pool.Where(p => p.Level == level).ToList();
            var questions = sameLevel
                .Where(p => !p.Text.Contains(' '))
                .OrderBy(_ => Random.Shared.Next())
                .Select(p => BuildQuestion(p, sameLevel))
                .OfType<PlacementQuestionDto>()
                .Take(PlacementRules.QuestionsPerLevel)
                .ToList();
            return new PlacementLevelDto(level, questions);
        }).ToList();
    }

    /// <summary>Distractors come from the same level and part of speech, so the word itself is the only clue.</summary>
    private static PlacementQuestionDto? BuildQuestion(PoolWord word, IReadOnlyList<PoolWord> sameLevel)
    {
        bool Distinct(PoolWord p) =>
            p.Id != word.Id
            && !string.Equals(p.Text, word.Text, StringComparison.OrdinalIgnoreCase)
            && !p.MeaningVi.Contains(word.MeaningVi, StringComparison.OrdinalIgnoreCase)
            && !word.MeaningVi.Contains(p.MeaningVi, StringComparison.OrdinalIgnoreCase);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { word.MeaningVi };
        var options = new List<string> { word.MeaningVi };
        foreach (var candidate in sameLevel.Where(p => p.Pos == word.Pos && Distinct(p)).OrderBy(_ => Random.Shared.Next()))
        {
            if (options.Count == PlacementRules.OptionCount) break;
            if (seen.Add(candidate.MeaningVi)) options.Add(candidate.MeaningVi);
        }
        if (options.Count < PlacementRules.OptionCount) return null;

        options = options.OrderBy(_ => Random.Shared.Next()).ToList();
        return new PlacementQuestionDto(word.Id, word.Text, word.Ipa, word.Pos, options, options.IndexOf(word.MeaningVi));
    }

    public async Task<ApplyPlacementResponse> ApplyAsync(Guid userId, ApplyPlacementRequest request, CancellationToken ct = default)
    {
        var level = request.Level?.Trim().ToUpperInvariant();
        var rank = PlacementRules.Rank(level);
        if (rank < 0) throw new InvalidOperationException("Cấp độ không hợp lệ.");
        var mode = request.Mode?.Trim().ToLowerInvariant();
        if (mode is null || !PlacementRules.Modes.Contains(mode)) throw new InvalidOperationException("Chế độ không hợp lệ.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy người dùng.");

        var cleared = await db.WordProgresses
            .Where(p => p.UserId == userId && p.FromPlacement)
            .ExecuteDeleteAsync(ct);

        user.VocabLevel = level;
        user.EasyWordMode = mode;
        if (request.Tested) user.PlacementTakenAt = DateTimeOffset.UtcNow;

        var marked = 0;
        if (mode == PlacementRules.ModeKnown && rank > 0)
        {
            var easier = PlacementRules.Levels[..rank];
            var wordIds = await db.Words.AsNoTracking()
                .Where(w => w.Published && easier.Contains(w.Level))
                .Where(w => !db.WordProgresses.Any(p => p.UserId == userId && p.WordId == w.Id))
                .Select(w => w.Id)
                .ToListAsync(ct);

            var now = DateTimeOffset.UtcNow;
            db.WordProgresses.AddRange(wordIds.Select(id => new WordProgress
            {
                UserId = userId,
                WordId = id,
                Status = WordStatus.Known,
                ReviewLevel = ReviewSchedule.MasteredLevel,
                NextReviewAt = now.AddDays(Random.Shared.Next(PlacementRules.KnownReviewMinDays, PlacementRules.KnownReviewMaxDays + 1)),
                UpdatedAt = now,
                FromPlacement = true,
            }));
            marked = wordIds.Count;
        }

        await db.SaveChangesAsync(ct);
        return new ApplyPlacementResponse(await auth.GetMeAsync(userId, ct), marked, cleared);
    }
}
