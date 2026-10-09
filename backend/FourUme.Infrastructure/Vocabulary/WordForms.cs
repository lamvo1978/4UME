namespace FourUme.Infrastructure.Vocabulary;

/// <summary>
/// Irregular English forms. Used both ways: shown on word cards ("go – went – gone") and to map an
/// inflected search query back to its base word ("went" → go). Regular suffixes are handled by rules.
/// </summary>
internal static class WordForms
{
    // "base past participle"; alternatives separated by "/".
    private static readonly string[] Verbs =
    [
        "arise arose arisen", "awake awoke awoken", "be was/were been", "bear bore born/borne",
        "beat beat beaten", "become became become", "begin began begun", "bend bent bent", "bet bet bet",
        "bid bid bid", "bind bound bound", "bite bit bitten", "bleed bled bled", "blow blew blown",
        "break broke broken", "breed bred bred", "bring brought brought", "broadcast broadcast broadcast",
        "build built built", "burn burnt/burned burnt/burned", "burst burst burst", "buy bought bought",
        "catch caught caught", "choose chose chosen", "cling clung clung", "come came come",
        "cost cost cost", "creep crept crept", "cut cut cut", "deal dealt dealt", "dig dug dug",
        "do did done", "draw drew drawn", "dream dreamt/dreamed dreamt/dreamed", "drink drank drunk",
        "drive drove driven", "eat ate eaten", "fall fell fallen", "feed fed fed", "feel felt felt",
        "fight fought fought", "find found found", "flee fled fled", "fling flung flung", "fly flew flown",
        "forbid forbade forbidden", "forecast forecast forecast", "foresee foresaw foreseen",
        "forget forgot forgotten", "forgive forgave forgiven", "freeze froze frozen", "get got got/gotten",
        "give gave given", "go went gone", "grind ground ground", "grow grew grown", "hang hung hung",
        "have had had", "hear heard heard", "hide hid hidden", "hit hit hit", "hold held held",
        "hurt hurt hurt", "keep kept kept", "kneel knelt knelt", "know knew known", "lay laid laid",
        "lead led led", "lean leant/leaned leant/leaned", "leap leapt/leaped leapt/leaped",
        "learn learnt/learned learnt/learned", "leave left left", "lend lent lent", "let let let",
        "lie lay lain", "light lit lit", "lose lost lost", "make made made", "mean meant meant",
        "meet met met", "mislead misled misled", "mistake mistook mistaken",
        "misunderstand misunderstood misunderstood", "overcome overcame overcome",
        "overhear overheard overheard", "overtake overtook overtaken", "pay paid paid",
        "prove proved proven/proved", "put put put", "quit quit quit", "read read read", "rid rid rid",
        "ride rode ridden", "ring rang rung", "rise rose risen", "run ran run", "say said said",
        "see saw seen", "seek sought sought", "sell sold sold", "send sent sent", "set set set",
        "sew sewed sewn", "shake shook shaken", "shine shone shone", "shoot shot shot",
        "show showed shown", "shrink shrank shrunk", "shut shut shut", "sing sang sung", "sink sank sunk",
        "sit sat sat", "sleep slept slept", "slide slid slid", "smell smelt/smelled smelt/smelled",
        "speak spoke spoken", "speed sped sped", "spell spelt/spelled spelt/spelled", "spend spent spent",
        "spill spilt/spilled spilt/spilled", "spin spun spun", "spit spat spat", "split split split",
        "spoil spoilt/spoiled spoilt/spoiled", "spread spread spread", "spring sprang sprung",
        "stand stood stood", "steal stole stolen", "stick stuck stuck", "sting stung stung",
        "stink stank stunk", "strike struck struck", "strive strove striven", "swear swore sworn",
        "sweep swept swept", "swell swelled swollen", "swim swam swum", "swing swung swung",
        "take took taken", "teach taught taught", "tear tore torn", "tell told told", "think thought thought",
        "throw threw thrown", "tread trod trodden", "undergo underwent undergone",
        "understand understood understood", "undertake undertook undertaken", "uphold upheld upheld",
        "upset upset upset", "wake woke woken", "wear wore worn", "weave wove woven", "weep wept wept",
        "win won won", "wind wound wound", "withdraw withdrew withdrawn", "withhold withheld withheld",
        "withstand withstood withstood", "write wrote written",
        "dive dived/dove dived", "fit fitted/fit fitted/fit", "outdo outdid outdone", "outgrow outgrew outgrown",
        "overthrow overthrew overthrown", "rebuild rebuilt rebuilt", "redo redid redone", "repay repaid repaid",
        "retell retold retold", "rewrite rewrote rewritten", "stride strode stridden", "undo undid undone",
        "wed wed/wedded wed/wedded",
    ];

    // Forms the suffix rules can't derive ("lying" would become "ly").
    private static readonly string[] ExtraVerbForms =
        ["be: am is are being", "have: has having", "do: does doing", "lie: lying", "die: dying", "tie: tying"];

    private static readonly string[] Plurals =
    [
        "child children", "man men", "woman women", "person people", "foot feet", "tooth teeth",
        "mouse mice", "goose geese", "ox oxen", "life lives", "knife knives", "wife wives", "leaf leaves",
        "half halves", "shelf shelves", "wolf wolves", "thief thieves", "loaf loaves",
        "criterion criteria", "phenomenon phenomena", "analysis analyses", "crisis crises",
        "thesis theses", "hypothesis hypotheses",
    ];

    private static readonly string[] Comparatives =
    [
        "good better best", "well better best", "bad worse worst", "badly worse worst", "many more most",
        "much more most", "little less least", "far further/farther furthest/farthest",
    ];

    private static readonly Dictionary<string, string[]> VerbTable = Table(Verbs);
    private static readonly Dictionary<string, string[]> PluralTable = Table(Plurals);
    private static readonly Dictionary<string, string[]> ComparativeTable = Table(Comparatives);
    private static readonly Dictionary<string, string[]> BasesByForm = BuildReverse();

    private static Dictionary<string, string[]> Table(string[] rows) =>
        rows.Select(r => r.Split(' ')).ToDictionary(p => p[0], p => p[1..]);

    private static Dictionary<string, string[]> BuildReverse()
    {
        var map = new Dictionary<string, HashSet<string>>();
        void Add(string lemma, string forms)
        {
            foreach (var form in forms.Split('/', ' '))
                if (form.Length > 0 && form != lemma)
                    (map.TryGetValue(form, out var s) ? s : map[form] = []).Add(lemma);
        }
        foreach (var table in new[] { VerbTable, PluralTable, ComparativeTable })
            foreach (var (lemma, forms) in table) Add(lemma, string.Join(' ', forms));
        foreach (var line in ExtraVerbForms)
        {
            var parts = line.Split(':');
            Add(parts[0].Trim(), parts[1].Trim());
        }
        return map.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
    }

    /// <summary>
    /// Irregular forms to show on the card, e.g. "go – went – gone", "số nhiều: children",
    /// "good – better – best"; null for regular words.
    /// </summary>
    public static string? Describe(string word, string pos)
    {
        var key = word.ToLowerInvariant();
        return pos switch
        {
            "verb" when VerbTable.TryGetValue(key, out var v) => $"{key} – {v[0]} – {v[1]}",
            "noun" when PluralTable.TryGetValue(key, out var p) => $"số nhiều: {p[0]}",
            "adjective" or "adverb" or "determiner" or "pronoun" when ComparativeTable.TryGetValue(key, out var c) =>
                $"{key} – {c[0]} – {c[1]}",
            _ => null,
        };
    }

    /// <summary>Possible base forms of <paramref name="form"/> (lowercase), excluding the form itself.</summary>
    public static IEnumerable<string> BaseCandidates(string form)
    {
        if (form.Length < 3 || form.Contains(' ')) yield break;
        if (BasesByForm.TryGetValue(form, out var irregular))
            foreach (var b in irregular) yield return b;

        foreach (var (suffix, replacements) in Suffixes)
        {
            if (!form.EndsWith(suffix, StringComparison.Ordinal) || form.Length - suffix.Length < 2) continue;
            var stem = form[..^suffix.Length];
            foreach (var r in replacements) yield return stem + r;
            // stopped → stop, running → run, bigger → big
            if (suffix is "ed" or "ing" or "er" or "est" && stem.Length >= 3 && stem[^1] == stem[^2])
                yield return stem[..^1];
        }
    }

    private static readonly (string Suffix, string[] Replacements)[] Suffixes =
    [
        ("ies", ["y"]), ("ied", ["y"]), ("ier", ["y"]), ("iest", ["y"]),
        ("es", ["", "e"]), ("s", [""]),
        ("ed", ["", "e"]), ("ing", ["", "e"]),
        ("er", ["", "e"]), ("est", ["", "e"]),
    ];
}
