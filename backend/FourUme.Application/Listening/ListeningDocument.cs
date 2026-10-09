using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using FourUme.Application.Grammar;
using FourUme.Domain.Entities;

namespace FourUme.Application.Listening;

/// <summary>A listening piece as authored in data/listening/*.json (docs/listening.md).</summary>
public sealed class ListeningLessonDocument
{
    public string Slug { get; set; } = "";
    public int Version { get; set; }
    public string TitleEn { get; set; } = "";
    public string TitleVi { get; set; } = "";
    public string Kind { get; set; } = ListeningKinds.Dialogue;
    public string Level { get; set; } = "";
    public string? Topic { get; set; }
    public int Order { get; set; }
    public string SummaryVi { get; set; } = "";
    public bool? Published { get; set; }
    public List<ListeningSpeaker> Speakers { get; set; } = [];
    public List<ListeningLine> Lines { get; set; } = [];
}

public sealed class ListeningSpeaker
{
    /// <summary>Referenced by <see cref="ListeningLine.Speaker"/>.</summary>
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Azure neural voice, e.g. en-US-JennyNeural.</summary>
    public string Voice { get; set; } = "";
}

public sealed class ListeningLine
{
    public string Speaker { get; set; } = "";
    public string En { get; set; } = "";
    public string Vi { get; set; } = "";
}

public sealed record ListeningVoice(string Name, string Label, string Accent, string Gender);

public static partial class ListeningRules
{
    public const int MaxLines = 80;
    public const int MaxLineChars = 400;
    /// <summary>Listened this far (fraction of the duration) counts as finished.</summary>
    public const double CompleteAt = 0.9;

    public static readonly ListeningVoice[] Voices =
    [
        new("en-US-JennyNeural", "Jenny", "Mỹ", "nữ"),
        new("en-US-GuyNeural", "Guy", "Mỹ", "nam"),
        new("en-US-AriaNeural", "Aria", "Mỹ", "nữ"),
        new("en-US-DavisNeural", "Davis", "Mỹ", "nam"),
        new("en-US-AnaNeural", "Ana", "Mỹ", "bé gái"),
        new("en-GB-SoniaNeural", "Sonia", "Anh", "nữ"),
        new("en-GB-RyanNeural", "Ryan", "Anh", "nam"),
        new("en-AU-NatashaNeural", "Natasha", "Úc", "nữ"),
        new("en-AU-WilliamNeural", "William", "Úc", "nam"),
    ];

    [System.Text.RegularExpressions.GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial System.Text.RegularExpressions.Regex SlugPattern();

    [System.Text.RegularExpressions.GeneratedRegex("^[a-z0-9]{1,16}$")]
    private static partial System.Text.RegularExpressions.Regex KeyPattern();

    private static bool Blank(string? s) => string.IsNullOrWhiteSpace(s);

    /// <summary>Problems that block saving even a hidden draft.</summary>
    public static List<string> ValidateBasics(ListeningLessonDocument l)
    {
        var errors = new List<string>();
        if (Blank(l.Slug)) errors.Add("Thiếu mã bài (slug).");
        else if (l.Slug.Length > 80 || !SlugPattern().IsMatch(l.Slug)) errors.Add("Mã bài chỉ gồm chữ thường, số và dấu gạch nối (vd: at-the-cafe).");
        if (Blank(l.TitleEn)) errors.Add("Thiếu tên bài tiếng Anh.");
        if (Blank(l.TitleVi)) errors.Add("Thiếu tên bài tiếng Việt.");
        if (!ListeningKinds.All.Contains(l.Kind)) errors.Add($"Thể loại không hợp lệ: {l.Kind}.");
        if (Blank(l.Level)) errors.Add("Thiếu cấp độ (A1–B2).");
        else if (!GrammarValidator.Levels.Contains(l.Level)) errors.Add($"Cấp độ không hợp lệ: {l.Level}.");
        if (l.Lines.Count > MaxLines) errors.Add($"Tối đa {MaxLines} câu mỗi bài.");
        return errors;
    }

    /// <summary>Returns human-readable problems; an empty list means the lesson can be published.</summary>
    public static List<string> Validate(ListeningLessonDocument l)
    {
        var errors = ValidateBasics(l);
        if (l.Version < 1) errors.Add("version phải ≥ 1.");
        if (Blank(l.SummaryVi)) errors.Add("Thiếu tóm tắt bài.");
        if (l.Speakers.Count == 0) errors.Add("Chưa có người đọc.");
        if (l.Lines.Count < 2) errors.Add("Cần ít nhất 2 câu.");

        var keys = new HashSet<string>();
        foreach (var s in l.Speakers)
        {
            var where = $"Người đọc \"{s.Name}\"";
            if (!KeyPattern().IsMatch(s.Key) || !keys.Add(s.Key)) errors.Add($"{where}: mã trống, trùng hoặc không hợp lệ (chữ thường/số).");
            if (Blank(s.Name)) errors.Add($"Người đọc {s.Key}: thiếu tên.");
            if (!Voices.Any(v => v.Name == s.Voice)) errors.Add($"{where}: giọng không hợp lệ ({s.Voice}).");
        }

        for (var i = 0; i < l.Lines.Count; i++)
        {
            var line = l.Lines[i];
            var where = $"Câu {i + 1}";
            if (!keys.Contains(line.Speaker)) errors.Add($"{where}: người đọc \"{line.Speaker}\" không có trong danh sách.");
            if (Blank(line.En)) errors.Add($"{where}: thiếu câu tiếng Anh.");
            else if (line.En.Length > MaxLineChars) errors.Add($"{where}: dài quá {MaxLineChars} ký tự, nên tách ra.");
            if (Blank(line.Vi)) errors.Add($"{where}: thiếu bản dịch.");
        }
        return errors;
    }

    public static int CharCount(ListeningLessonDocument l) => l.Lines.Sum(x => x.En.Trim().Length);

    /// <summary>
    /// Fingerprint of what the audio depends on (voices, speaking rate by level, the English text);
    /// titles and translations can change without making the audio stale.
    /// </summary>
    public static string AudioHash(ListeningLessonDocument l)
    {
        var voices = l.Speakers.ToDictionary(s => s.Key, s => s.Voice);
        var parts = l.Lines.Select(x => $"{voices.GetValueOrDefault(x.Speaker)}|{x.En.Trim()}");
        var text = $"{SpeakingRate(l.Level)}\n{string.Join('\n', parts)}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..32].ToLowerInvariant();
    }

    /// <summary>SSML prosody rate: slower for beginners.</summary>
    public static string SpeakingRate(string level) => level switch
    {
        "A1" => "-15%",
        "A2" => "-8%",
        _ => "0%",
    };

    public static ListeningLessonDocument Normalize(ListeningLessonDocument l) => new()
    {
        Slug = l.Slug.Trim().ToLowerInvariant(),
        Version = l.Version,
        TitleEn = l.TitleEn.Trim(),
        TitleVi = l.TitleVi.Trim(),
        Kind = l.Kind.Trim(),
        Level = l.Level.Trim().ToUpperInvariant(),
        Topic = string.IsNullOrWhiteSpace(l.Topic) ? null : l.Topic.Trim(),
        Order = l.Order,
        SummaryVi = l.SummaryVi.Trim(),
        Published = l.Published,
        Speakers = l.Speakers.Select(s => new ListeningSpeaker { Key = s.Key.Trim(), Name = s.Name.Trim(), Voice = s.Voice.Trim() }).ToList(),
        Lines = l.Lines.Select(x => new ListeningLine { Speaker = x.Speaker.Trim(), En = x.En.Trim(), Vi = x.Vi.Trim() }).ToList(),
    };

    public static ListeningLessonDocument ToDocument(ListeningLesson l) => new()
    {
        Slug = l.Slug,
        Version = l.Version,
        TitleEn = l.TitleEn,
        TitleVi = l.TitleVi,
        Kind = l.Kind,
        Level = l.Level,
        Topic = l.Topic,
        Order = l.SortOrder,
        SummaryVi = l.SummaryVi,
        Published = l.Published,
        Speakers = JsonSerializer.Deserialize<List<ListeningSpeaker>>(l.SpeakersJson, GrammarJson.Options) ?? [],
        Lines = JsonSerializer.Deserialize<List<ListeningLine>>(l.LinesJson, GrammarJson.Options) ?? [],
    };

    /// <summary>Copies the document onto the entity; audio fields are left as they are.</summary>
    public static void Apply(ListeningLessonDocument d, ListeningLesson l)
    {
        l.Version = d.Version;
        l.TitleEn = d.TitleEn;
        l.TitleVi = d.TitleVi;
        l.Kind = d.Kind;
        l.Level = d.Level;
        l.Topic = d.Topic;
        l.SortOrder = d.Order;
        l.SummaryVi = d.SummaryVi;
        l.Published = d.Published ?? true;
        l.SpeakersJson = JsonSerializer.Serialize(d.Speakers, GrammarJson.Options);
        l.LinesJson = JsonSerializer.Serialize(d.Lines, GrammarJson.Options);
        l.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public static List<int[]>? ReadTimings(ListeningLesson l) =>
        l.TimingsJson is null ? null : JsonSerializer.Deserialize<List<int[]>>(l.TimingsJson);

    /// <summary>Audio that still matches the current script, or null.</summary>
    public static bool AudioIsCurrent(ListeningLesson l, ListeningLessonDocument d) =>
        l.AudioUrl is not null && l.AudioHash == AudioHash(d);
}
