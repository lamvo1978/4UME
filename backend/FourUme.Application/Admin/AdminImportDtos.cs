using FourUme.Application.Grammar;

namespace FourUme.Application.Admin;

public static class ImportStatus
{
    public const string Create = "create";
    public const string Update = "update";
    public const string Unchanged = "unchanged";
    /// <summary>Matches an existing word but updating existing words is off.</summary>
    public const string Duplicate = "duplicate";
    public const string Error = "error";
}

/// <summary>
/// One spreadsheet row. A null field means the column is absent (keep the current value when updating);
/// an empty string clears it.
/// </summary>
/// <param name="Line">Row number in the file, echoed back in the result.</param>
/// <param name="Deck">Deck id or title.</param>
/// <param name="Published">1/0, true/false, yes/no, có/không, hiện/ẩn; empty = visible.</param>
public record ImportWordRow(
    int Line,
    string? Id,
    string? Word,
    string? Pos,
    string? Level,
    string? Deck,
    string? MeaningVi,
    string? Ipa,
    string? Example,
    string? ExampleVi,
    string? ImageUrl,
    string? Published);

/// <param name="UpdateExisting">Rows matching an existing word (by id, or by word + part of speech) overwrite it.</param>
/// <param name="Commit">false = preview only.</param>
public record ImportWordsRequest(IReadOnlyList<ImportWordRow> Rows, bool UpdateExisting, bool Commit);

/// <param name="Changes">Field names that differ from the stored word (updates only).</param>
public record ImportWordRowResult(int Line, string Word, string Pos, string Status, string? Id, IReadOnlyList<string> Messages, IReadOnlyList<string> Changes);

public record ImportWordsResult(int Created, int Updated, int Unchanged, int Duplicates, int Errors, bool Committed, IReadOnlyList<ImportWordRowResult> Rows);

public record ExportWordDto(
    string Id,
    string Word,
    string Pos,
    string Level,
    string Deck,
    string DeckTitleVi,
    string MeaningVi,
    string Ipa,
    string Example,
    string ExampleVi,
    string? ImageUrl,
    bool Published);

public record ImportGrammarRequest(IReadOnlyList<GrammarLessonDocument> Lessons, bool Commit);

/// <param name="CurrentVersion">Version stored in the database, when the lesson already exists.</param>
public record ImportGrammarRowResult(string Slug, string TitleVi, string Status, int? CurrentVersion, IReadOnlyList<string> Problems);

public record ImportGrammarResult(int Created, int Updated, int Unchanged, int Errors, bool Committed, IReadOnlyList<ImportGrammarRowResult> Rows);
