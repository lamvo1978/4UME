using System.Text.Json;
using System.Text.Json.Serialization;

namespace FourUme.Application.Grammar;

/// <summary>A lesson as authored in data/grammar/*.json (see docs/grammar-lesson-schema.md).</summary>
public sealed class GrammarLessonDocument
{
    public string Slug { get; set; } = "";
    public int Version { get; set; }
    public string TitleVi { get; set; } = "";
    public string? TitleEn { get; set; }
    public string Level { get; set; } = "";
    public int Order { get; set; }
    public string SummaryVi { get; set; } = "";
    public int? QuizSize { get; set; }
    public bool? Published { get; set; }
    public List<GrammarSection> Sections { get; set; } = [];
    public List<GrammarExercise> Exercises { get; set; } = [];
}

public sealed class Bilingual
{
    public string En { get; set; } = "";
    public string Vi { get; set; } = "";
}

public sealed class GrammarSection
{
    public string Type { get; set; } = "";
    public string? Title { get; set; }
    public string? TextVi { get; set; }
    public List<GrammarSectionItem>? Items { get; set; }
    public List<GrammarFormulaRow>? Rows { get; set; }
    public List<string>? Headers { get; set; }
    public List<List<string>>? Cells { get; set; }
    public List<string>? Words { get; set; }
}

public sealed class GrammarSectionItem
{
    public string? TextVi { get; set; }
    public Bilingual? Example { get; set; }
    public string? En { get; set; }
    public string? Vi { get; set; }
    public string? Wrong { get; set; }
    public string? Right { get; set; }
    public string? NoteVi { get; set; }
}

public sealed class GrammarFormulaRow
{
    public string Kind { get; set; } = "";
    public string Pattern { get; set; } = "";
    public Bilingual? Example { get; set; }
}

public sealed class GrammarExercise
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public string? Prompt { get; set; }
    public string? PromptVi { get; set; }
    public string? InstructionVi { get; set; }
    public string? Source { get; set; }
    public string? Sentence { get; set; }
    public List<string>? Options { get; set; }
    public string? Answer { get; set; }
    public List<string>? Answers { get; set; }
    public List<string>? Distractors { get; set; }
    public string? Correction { get; set; }
    public string ExplanationVi { get; set; } = "";
}

public static class GrammarJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };
}

public static partial class GrammarValidator
{
    public static readonly string[] Levels = ["A1", "A2", "B1", "B2"];
    public static readonly string[] SectionTypes = ["usage", "formula", "table", "examples", "signals", "mistakes", "tip"];
    public static readonly string[] ExerciseTypes = ["mcq", "fill", "order", "transform", "error"];
    public static readonly string[] FormulaKinds = ["affirmative", "negative", "question", "short-answer", "note"];

    [System.Text.RegularExpressions.GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial System.Text.RegularExpressions.Regex SlugPattern();

    /// <summary>Problems that block saving even a hidden draft.</summary>
    public static List<string> ValidateBasics(GrammarLessonDocument l)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(l.Slug)) errors.Add("Thiếu mã bài (slug).");
        else if (l.Slug.Length > 80 || !SlugPattern().IsMatch(l.Slug)) errors.Add("Mã bài chỉ gồm chữ thường, số và dấu gạch nối (vd: present-simple).");
        if (string.IsNullOrWhiteSpace(l.TitleVi)) errors.Add("Thiếu tên bài tiếng Việt.");
        if (string.IsNullOrWhiteSpace(l.Level)) errors.Add("Thiếu cấp độ (A1–B2).");
        else if (!Levels.Contains(l.Level)) errors.Add($"Cấp độ không hợp lệ: {l.Level}.");
        if (l.QuizSize is < 1 or > 30) errors.Add("Số câu mỗi lượt phải từ 1 đến 30.");
        return errors;
    }

    /// <summary>Returns human-readable problems; an empty list means the lesson can be published.</summary>
    public static List<string> Validate(GrammarLessonDocument l)
    {
        var errors = ValidateBasics(l);
        if (l.Version < 1) errors.Add("version phải ≥ 1.");
        if (string.IsNullOrWhiteSpace(l.SummaryVi)) errors.Add("Thiếu tóm tắt bài.");
        if (l.Sections.Count == 0) errors.Add("Chưa có phần lý thuyết.");
        if (l.Exercises.Count == 0) errors.Add("Chưa có bài tập.");

        for (var i = 0; i < l.Sections.Count; i++)
            ValidateSection(l.Sections[i], $"Lý thuyết khối {i + 1}", errors);

        var ids = new HashSet<string>();
        foreach (var e in l.Exercises)
        {
            var where = $"Bài tập {e.Id}";
            if (string.IsNullOrWhiteSpace(e.Id) || !ids.Add(e.Id)) errors.Add($"{where}: mã trống hoặc trùng.");
            if (string.IsNullOrWhiteSpace(e.ExplanationVi)) errors.Add($"{where}: thiếu giải thích.");
            ValidateExercise(e, where, errors);
        }
        return errors;
    }

    private static bool Blank(string? s) => string.IsNullOrWhiteSpace(s);

    private static void ValidateSection(GrammarSection s, string where, List<string> errors)
    {
        switch (s.Type)
        {
            case "usage":
                if (s.Items is not { Count: > 0 } || s.Items.Any(i => Blank(i.TextVi))) errors.Add($"{where} (cách dùng): cần ít nhất một ý, không để trống.");
                break;
            case "formula":
                if (s.Rows is not { Count: > 0 } || s.Rows.Any(r => Blank(r.Pattern))) errors.Add($"{where} (công thức): cần ít nhất một dòng có công thức.");
                else if (s.Rows.Any(r => !FormulaKinds.Contains(r.Kind))) errors.Add($"{where} (công thức): dạng câu không hợp lệ.");
                break;
            case "table":
                if (s.Headers is not { Count: > 0 } || s.Cells is not { Count: > 0 }) errors.Add($"{where} (bảng): cần tiêu đề cột và ít nhất một dòng.");
                else if (s.Cells.Any(r => r.Count != s.Headers.Count)) errors.Add($"{where} (bảng): mỗi dòng phải có {s.Headers.Count} ô.");
                break;
            case "examples":
                if (s.Items is not { Count: > 0 } || s.Items.Any(i => Blank(i.En))) errors.Add($"{where} (ví dụ): cần ít nhất một câu ví dụ.");
                break;
            case "signals":
                if (s.Words is not { Count: > 0 } || s.Words.Any(Blank)) errors.Add($"{where} (dấu hiệu): cần ít nhất một từ.");
                break;
            case "mistakes":
                if (s.Items is not { Count: > 0 } || s.Items.Any(i => Blank(i.Wrong) || Blank(i.Right))) errors.Add($"{where} (lỗi hay gặp): mỗi lỗi cần câu sai và câu đúng.");
                break;
            case "tip":
                if (Blank(s.TextVi)) errors.Add($"{where} (mẹo): chưa có nội dung.");
                break;
            default:
                errors.Add($"{where}: loại khối không hợp lệ: {s.Type}.");
                break;
        }
    }

    private static void ValidateExercise(GrammarExercise e, string where, List<string> errors)
    {
        switch (e.Type)
        {
            case "mcq":
                if (Blank(e.Prompt)) errors.Add($"{where}: thiếu câu hỏi.");
                if (e.Options is not { Count: >= 2 } || e.Options.Any(Blank)) errors.Add($"{where}: cần ít nhất 2 lựa chọn, không để trống.");
                else if (e.Options.Distinct().Count() != e.Options.Count) errors.Add($"{where}: các lựa chọn bị trùng.");
                else if (e.Answer is null || !e.Options.Contains(e.Answer)) errors.Add($"{where}: đáp án phải là một trong các lựa chọn.");
                break;
            case "fill":
                if (e.Prompt?.Contains("___") != true) errors.Add($"{where}: câu cần có chỗ trống ___.");
                if (e.Answers is not { Count: > 0 } || e.Answers.Any(Blank)) errors.Add($"{where}: cần ít nhất một đáp án.");
                break;
            case "order":
                if (Blank(e.PromptVi)) errors.Add($"{where}: thiếu câu tiếng Việt.");
                if (Blank(e.Answer) || e.Answer!.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length < 2) errors.Add($"{where}: câu đúng cần ít nhất 2 từ.");
                break;
            case "transform":
                if (Blank(e.InstructionVi)) errors.Add($"{where}: thiếu yêu cầu (vd: Chuyển sang câu phủ định).");
                if (Blank(e.Source) || Blank(e.Answer)) errors.Add($"{where}: cần câu gốc và câu đúng.");
                break;
            case "error":
                if (e.Sentence is null || e.Sentence.Count(c => c == '[') != 1 || e.Sentence.Count(c => c == ']') != 1
                    || e.Sentence.IndexOf('[') > e.Sentence.IndexOf(']'))
                    errors.Add($"{where}: câu cần đúng một [từ sai] trong ngoặc vuông.");
                if (Blank(e.Correction)) errors.Add($"{where}: thiếu từ sửa đúng.");
                break;
            default:
                errors.Add($"{where}: dạng bài không hợp lệ: {e.Type}.");
                break;
        }
    }
}
