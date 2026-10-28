using FourUme.Application.Grammar;

namespace FourUme.Infrastructure.Ai;

/// <summary>Shared AI checker helpers for MCQ drafts (placement + grammar).</summary>
public static class McqDraftCheck
{
    public static string FormatWarning(string problemVi, IReadOnlyList<string> suggestions)
    {
        if (suggestions.Count > 0) return problemVi;
        if (problemVi.Contains("đáp án", StringComparison.OrdinalIgnoreCase)
            || problemVi.Contains("correct", StringComparison.OrdinalIgnoreCase)
            || problemVi.Contains("liệt kê", StringComparison.OrdinalIgnoreCase))
            return problemVi + " (AI chưa nêu tên option — duyệt từng lựa chọn phụ.)";
        return problemVi;
    }

    public static List<string> NormalizeAlsoSuggestions(
        IReadOnlyList<string> options,
        string answer,
        IReadOnlyList<string>? acceptedAnswers,
        List<string>? raw)
    {
        if (raw is null || raw.Count == 0) return [];
        var accepted = new HashSet<string>(acceptedAnswers ?? [], StringComparer.OrdinalIgnoreCase) { answer };
        return raw
            .Select(o => o.Trim())
            .Select(o => options.FirstOrDefault(opt => string.Equals(opt, o, StringComparison.OrdinalIgnoreCase)))
            .Where(o => o is { Length: > 0 })
            .Where(o => !accepted.Contains(o))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList()!;
    }

    public static List<string> ForExercise(GrammarExercise e, List<string>? raw) =>
        e.Type == "mcq" && e.Options is { Count: > 0 } opts && !string.IsNullOrWhiteSpace(e.Answer)
            ? NormalizeAlsoSuggestions(opts, e.Answer, e.AcceptedAnswers, raw)
            : [];
}
