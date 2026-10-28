namespace FourUme.Application.Grammar;

public static class McqAnswers
{
    /// <summary>Every option text that counts as correct (primary answer plus any extras).</summary>
    public static HashSet<string> Accepted(IReadOnlyList<string> options, string answer, IEnumerable<string>? alsoAccepted)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void TryAdd(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            var match = options.FirstOrDefault(o => string.Equals(o, text.Trim(), StringComparison.OrdinalIgnoreCase));
            if (match is not null) set.Add(match);
        }
        TryAdd(answer);
        foreach (var a in alsoAccepted ?? []) TryAdd(a);
        return set;
    }

    public static List<string> NormalizeAlso(IReadOnlyList<string> options, string answer, IEnumerable<string>? alsoAccepted)
    {
        var primary = answer.Trim();
        return (alsoAccepted ?? [])
            .Select(a => a.Trim())
            .Where(a => a.Length > 0 && !string.Equals(a, primary, StringComparison.OrdinalIgnoreCase))
            .Where(a => options.Contains(a, StringComparer.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
