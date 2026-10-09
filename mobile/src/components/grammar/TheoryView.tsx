import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { Bilingual, GrammarSection } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { SpeakButton } from "../SpeakButton";

const DEFAULT_TITLES: Record<GrammarSection["type"], string> = {
  usage: "Cách dùng",
  formula: "Công thức",
  table: "Bảng",
  examples: "Ví dụ",
  signals: "Dấu hiệu nhận biết",
  mistakes: "Lỗi hay gặp",
  tip: "Mẹo nhớ",
};

const KIND_LABELS = {
  affirmative: "Khẳng định",
  negative: "Phủ định",
  question: "Nghi vấn",
  "short-answer": "Trả lời ngắn",
  note: "Lưu ý",
} as const;

export function TheoryView({ sections }: { sections: GrammarSection[] }) {
  return (
    <View style={styles.root}>
      {sections.map((s, i) => (
        <View key={i} style={[styles.card, s.type === "tip" && styles.tipCard]}>
          <Text style={[styles.cardTitle, s.type === "tip" && styles.tipTitle]}>
            {s.type === "tip" ? "💡 " : ""}
            {s.title ?? DEFAULT_TITLES[s.type]}
          </Text>
          <SectionBody section={s} />
        </View>
      ))}
    </View>
  );
}

function SectionBody({ section: s }: { section: GrammarSection }) {
  switch (s.type) {
    case "usage":
      return (
        <View style={styles.list}>
          {s.items.map((it, i) => (
            <View key={i} style={styles.usageRow}>
              <View style={styles.bullet}>
                <Text style={styles.bulletText}>{i + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.body}>{it.textVi}</Text>
                {it.example ? <Example example={it.example} /> : null}
              </View>
            </View>
          ))}
        </View>
      );
    case "formula":
      return (
        <View style={styles.list}>
          {s.rows.map((r, i) => (
            <View key={i} style={styles.formulaRow}>
              <Text style={[styles.kind, r.kind === "negative" && styles.kindNegative, r.kind === "question" && styles.kindQuestion]}>
                {KIND_LABELS[r.kind] ?? r.kind}
              </Text>
              <Text style={styles.pattern}>{r.pattern}</Text>
              {r.example ? <Example example={r.example} /> : null}
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={styles.table}>
          <View style={[styles.tr, styles.thRow]}>
            {s.headers.map((h, i) => (
              <Text key={i} style={[styles.td, styles.th]}>
                {h}
              </Text>
            ))}
          </View>
          {s.cells.map((row, r) => (
            <View key={r} style={[styles.tr, r % 2 === 1 && styles.trAlt]}>
              {row.map((c, i) => (
                <Text key={i} style={[styles.td, i === 0 && styles.tdFirst]}>
                  {c}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "examples":
      return (
        <View style={styles.list}>
          {s.items.map((ex, i) => (
            <Example key={i} example={ex} large />
          ))}
        </View>
      );
    case "signals":
      return (
        <View style={styles.chips}>
          {s.words.map((w) => (
            <Text key={w} style={styles.chip}>
              {w}
            </Text>
          ))}
        </View>
      );
    case "mistakes":
      return (
        <View style={styles.list}>
          {s.items.map((m, i) => (
            <View key={i} style={styles.mistake}>
              <View style={styles.mistakeLine}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
                <Text style={styles.wrong}>{m.wrong}</Text>
              </View>
              <View style={styles.mistakeLine}>
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                <Text style={styles.right}>{m.right}</Text>
              </View>
              {m.noteVi ? <Text style={styles.note}>{m.noteVi}</Text> : null}
            </View>
          ))}
        </View>
      );
    case "tip":
      return <Text style={styles.body}>{s.textVi}</Text>;
  }
}

function Example({ example, large }: { example: Bilingual; large?: boolean }) {
  return (
    <View style={styles.example}>
      <View style={styles.flex}>
        <Text style={[styles.en, large && styles.enLarge]}>{example.en}</Text>
        {example.vi ? <Text style={styles.vi}>{example.vi}</Text> : null}
      </View>
      <SpeakButton text={example.en} size="sm" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, gap: 10, ...shadow.card, shadowOpacity: 0.05 },
  tipCard: { backgroundColor: colors.accentSoft, shadowOpacity: 0 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.accent },
  tipTitle: { color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  list: { gap: 12 },
  usageRow: { flexDirection: "row", gap: 10 },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  bulletText: { fontSize: 12, fontWeight: "800", color: colors.accent },
  formulaRow: { gap: 4 },
  kind: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  kindNegative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  kindQuestion: { color: colors.ink, backgroundColor: colors.bgAlt },
  pattern: { fontSize: 16, fontWeight: "700", color: colors.ink },
  table: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  tr: { flexDirection: "row" },
  thRow: { backgroundColor: colors.accentSoft },
  trAlt: { backgroundColor: colors.bg },
  td: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, fontSize: 14, color: colors.ink },
  tdFirst: { fontWeight: "700" },
  th: { fontWeight: "800", color: colors.accent },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  mistake: { gap: 4, paddingBottom: 2 },
  mistakeLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrong: { flex: 1, fontSize: 15, color: colors.danger, textDecorationLine: "line-through" },
  right: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.accent },
  note: { fontSize: 13, color: colors.muted, marginLeft: 24 },
  example: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  en: { fontSize: 15, fontStyle: "italic", color: colors.ink },
  enLarge: { fontSize: 16, fontStyle: "normal", fontWeight: "600" },
  vi: { fontSize: 13, color: colors.muted, marginTop: 1 },
});
