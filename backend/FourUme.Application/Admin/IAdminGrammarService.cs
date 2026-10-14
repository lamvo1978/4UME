using FourUme.Application.Grammar;

namespace FourUme.Application.Admin;

public interface IAdminGrammarService
{
    Task<IReadOnlyList<AdminGrammarSummaryDto>> GetLessonsAsync(CancellationToken ct = default);
    Task<AdminGrammarDetailDto?> GetLessonAsync(string slug, CancellationToken ct = default);
    Task<AdminGrammarDetailDto> CreateLessonAsync(GrammarLessonDocument lesson, CancellationToken ct = default);
    Task<AdminGrammarDetailDto> UpdateLessonAsync(string slug, GrammarLessonDocument lesson, CancellationToken ct = default);
    Task DeleteLessonAsync(string slug, CancellationToken ct = default);
    Task ReorderLessonsAsync(ReorderRequest request, CancellationToken ct = default);
    /// <summary>Writes a lesson snapshot back, recreating the lesson if it was deleted.</summary>
    Task RestoreLessonAsync(GrammarLessonDocument lesson, CancellationToken ct = default);
    /// <summary>All lessons in the same shape as data/grammar/*.json.</summary>
    Task<IReadOnlyList<GrammarLessonDocument>> ExportLessonsAsync(CancellationToken ct = default);
    /// <summary>Creates new slugs and updates existing ones; lessons with problems are skipped.</summary>
    Task<ImportGrammarResult> ImportLessonsAsync(ImportGrammarRequest request, CancellationToken ct = default);
    Task<GrammarVerbStatusDto> GetVerbStatusAsync(CancellationToken ct = default);
    /// <summary>Tags, in the background, the verb tenses of every question that has none yet.</summary>
    Task<GrammarVerbStatusDto> StartVerbTaggingAsync(CancellationToken ct = default);
}
