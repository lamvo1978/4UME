import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError, WritingCorrection, WritingSubmission } from "../api/client";
import { SpeakButton, speak, speechRate, stopSpeaking } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { formatDayMonthYear } from "../utils/dates";
import { KIND_LABELS, scoreColor, scoreVerdict } from "../writing/meta";

type Props = NativeStackScreenProps<RootStackParamList, "WritingResult">;

const SCORE_PARTS = [
  { key: "grammar", label: "Ngữ pháp" },
  { key: "vocabulary", label: "Từ vựng" },
  { key: "coherence", label: "Mạch lạc" },
  { key: "task", label: "Đúng đề" },
] as const;

export function WritingResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [submission, setSubmission] = useState<WritingSubmission | null>(route.params.submission ?? null);
  const [error, setError] = useState<{ message: string; locked: boolean } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (route.params.submission) return;
    api
      .writingSubmission(route.params.id)
      .then(setSubmission)
      .catch((e) => setError({ message: e instanceof Error ? e.message : "Không mở được bài viết", locked: e instanceof ApiError && e.status === 403 }));
  }, [route.params.id, route.params.submission]);

  useEffect(() => stopSpeaking, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name={error.locked ? "lock-closed-outline" : "alert-circle-outline"} size={32} color={colors.accent} />
        <Text style={styles.centerText}>{error.message}</Text>
        {error.locked ? (
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => navigation.navigate("Premium")}>
            <Text style={styles.primaryText}>Xem Premium</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (!submission) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const s = submission;
  const r = s.result;
  const color = scoreColor(r.score);
  const pick = selected !== null ? r.corrections[selected] : null;

  const rewriteAgain = () =>
    navigation.navigate("WritingEditor", {
      promptId: s.promptId,
      level: s.level,
      title: s.promptTitle ?? "Viết tự do",
      promptEn: s.promptEn,
      topic: s.topic,
      text: s.text,
      parentId: s.id,
    });

  const remove = () =>
    Alert.alert("Xoá bài viết?", "Bài và kết quả chấm sẽ bị xoá hẳn khỏi 4UME.", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: () =>
          void api
            .deleteWriting(s.id)
            .then(() => navigation.goBack())
            .catch((e) => Alert.alert("Chưa xoá được", e instanceof Error ? e.message : "Bạn thử lại nhé.")),
      },
    ]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.hero}>
        <View style={[styles.ring, { borderColor: color }]}>
          <Text style={[styles.ringScore, { color }]}>{r.score}</Text>
          <Text style={styles.ringMax}>/100</Text>
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.verdict}>{scoreVerdict(r.score)}</Text>
          <Text style={styles.heroMeta}>
            {s.promptTitle ?? (s.topic ? `Viết tự do: ${s.topic}` : "Viết tự do")} · {s.level} · {s.wordCount} từ
          </Text>
          <Text style={styles.heroMeta}>{formatDayMonthYear(s.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {SCORE_PARTS.map((p) => {
          const v = r.scores[p.key];
          return (
            <View key={p.key} style={styles.barRow}>
              <Text style={styles.barLabel}>{p.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${v}%`, backgroundColor: scoreColor(v) }]} />
              </View>
              <Text style={styles.barValue}>{v}</Text>
            </View>
          );
        })}
        {r.feedbackVi ? <Text style={styles.feedback}>{r.feedbackVi}</Text> : null}
      </View>

      <Text style={styles.label}>Bài của bạn{r.corrections.length ? ` · ${r.corrections.length} lỗi` : ""}</Text>
      <View style={styles.card}>
        <Text style={styles.essay}>
          <Highlighted text={s.text} corrections={r.corrections} selected={selected} onSelect={setSelected} />
        </Text>
        {r.corrections.some((c) => c.start >= 0) ? <Text style={styles.tapHint}>Chạm vào chỗ tô màu để xem cách sửa.</Text> : null}
        {pick ? <CorrectionCard c={pick} onClose={() => setSelected(null)} /> : null}
      </View>

      {r.corrections.length ? (
        <>
          <Text style={styles.label}>Lỗi cần sửa</Text>
          {r.corrections.map((c, i) => (
            <Pressable key={i} onPress={() => setSelected(i)} style={({ pressed }) => [styles.fix, selected === i && styles.fixOn, pressed && styles.pressed]}>
              <View style={styles.kind}>
                <Text style={styles.kindText}>{KIND_LABELS[c.kind] ?? c.kind}</Text>
              </View>
              <Text style={styles.fixLine}>
                <Text style={styles.wrong}>{c.original}</Text>
                {"  →  "}
                <Text style={styles.right}>{c.corrected}</Text>
              </Text>
              {c.explainVi ? <Text style={styles.explain}>{c.explainVi}</Text> : null}
            </Pressable>
          ))}
        </>
      ) : (
        <View style={styles.note}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text style={styles.noteText}>AI không thấy lỗi nào cần sửa. Giỏi lắm!</Text>
        </View>
      )}

      {r.rewrite || r.rewritePreview ? (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Bản viết lại hay hơn</Text>
            {r.rewrite ? (
              <Pressable onPress={() => speak(r.rewrite!, speechRate(), true)} hitSlop={10} style={styles.listen}>
                <Ionicons name="volume-high" size={16} color={colors.accent} />
                <Text style={styles.listenText}>Nghe</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.card}>
            {r.rewrite ? (
              <Text style={styles.rewrite}>{r.rewrite}</Text>
            ) : (
              <>
                <Text style={styles.rewrite}>{r.rewritePreview}</Text>
                <View style={styles.blurLines}>
                  {[95, 85, 90, 60].map((w, i) => (
                    <View key={i} style={[styles.blurLine, { width: `${w}%` }]} />
                  ))}
                </View>
                <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => navigation.navigate("Premium")}>
                  <Ionicons name="lock-open-outline" size={16} color={colors.white} />
                  <Text style={styles.primaryText}>Xem cả bài với Premium</Text>
                </Pressable>
              </>
            )}
          </View>
        </>
      ) : null}

      {r.upgrades.length ? (
        <>
          <Text style={styles.label}>Nâng cấp bài viết</Text>
          {r.upgrades.map((u, i) => (
            <View key={i} style={styles.upgrade}>
              <View style={styles.upgradeHead}>
                <Text style={styles.upgradeEn}>{u.en}</Text>
                <SpeakButton text={u.en} size="sm" />
              </View>
              <Text style={styles.upgradeVi}>{u.vi}</Text>
              {u.whyVi ? <Text style={styles.explain}>{u.whyVi}</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      <Pressable style={({ pressed }) => [styles.primary, styles.again, pressed && styles.pressed]} onPress={rewriteAgain}>
        <Ionicons name="refresh" size={18} color={colors.white} />
        <Text style={styles.primaryText}>Viết lại bài này</Text>
      </Pressable>
      <Text style={styles.againHint}>Sửa theo gợi ý rồi chấm lại để xem điểm tăng bao nhiêu (tính 1 lượt chấm).</Text>
      <Pressable onPress={remove} hitSlop={8} style={styles.delete}>
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
        <Text style={styles.deleteText}>Xoá bài này</Text>
      </Pressable>
    </ScrollView>
  );
}

/** The learner's text with each located mistake marked; tapping one selects it. */
function Highlighted({
  text,
  corrections,
  selected,
  onSelect,
}: {
  text: string;
  corrections: WritingCorrection[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const spans = corrections
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.start >= 0)
    .sort((a, b) => a.c.start - b.c.start);
  const parts: ReactNode[] = [];
  let at = 0;
  for (const { c, i } of spans) {
    if (c.start < at) continue;
    parts.push(text.slice(at, c.start));
    parts.push(
      <Text key={i} onPress={() => onSelect(i)} style={[styles.mark, selected === i && styles.markOn]}>
        {text.slice(c.start, c.start + c.original.length)}
      </Text>
    );
    at = c.start + c.original.length;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

function CorrectionCard({ c, onClose }: { c: WritingCorrection; onClose: () => void }) {
  return (
    <View style={styles.pick}>
      <View style={styles.pickHead}>
        <View style={styles.kind}>
          <Text style={styles.kindText}>{KIND_LABELS[c.kind] ?? c.kind}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={styles.wrong}>{c.original}</Text>
      <View style={styles.pickRight}>
        <Text style={[styles.right, styles.flex]}>{c.corrected}</Text>
        <SpeakButton text={c.corrected} size="sm" />
      </View>
      {c.explainVi ? <Text style={styles.explain}>{c.explainVi}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.bg, padding: spacing.lg },
  centerText: { fontSize: 14, lineHeight: 20, color: colors.ink, textAlign: "center" },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: 22, backgroundColor: colors.surface, ...shadow.card },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 6, alignItems: "center", justifyContent: "center" },
  ringScore: { fontSize: 28, fontWeight: "800" },
  ringMax: { fontSize: 11, fontWeight: "700", color: colors.muted, marginTop: -4 },
  heroBody: { flex: 1, gap: 2 },
  verdict: { fontSize: 18, fontWeight: "800", color: colors.ink },
  heroMeta: { fontSize: 12, color: colors.muted },
  card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.05 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { width: 76, fontSize: 13, fontWeight: "700", color: colors.ink },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgAlt, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 28, textAlign: "right", fontSize: 13, fontWeight: "800", color: colors.ink },
  feedback: { fontSize: 14, lineHeight: 21, color: colors.ink },
  label: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  labelRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  essay: { fontSize: 16, lineHeight: 26, color: colors.ink },
  mark: { backgroundColor: colors.flameSoft, color: colors.danger, textDecorationLine: "underline" },
  markOn: { backgroundColor: colors.gold, color: colors.ink },
  tapHint: { fontSize: 12, color: colors.muted },
  pick: { gap: 6, padding: 12, borderRadius: 14, backgroundColor: colors.bg },
  pickHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  fix: { gap: 6, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 2, borderColor: "transparent" },
  fixOn: { borderColor: colors.gold },
  kind: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.accentSoft },
  kindText: { fontSize: 11, fontWeight: "800", color: colors.accent },
  fixLine: { fontSize: 15, lineHeight: 22, color: colors.muted },
  wrong: { fontSize: 15, lineHeight: 22, color: colors.danger, textDecorationLine: "line-through" },
  right: { fontSize: 15, lineHeight: 22, color: colors.accent, fontWeight: "700" },
  explain: { fontSize: 13, lineHeight: 19, color: colors.muted },
  note: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.accentSoft },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.ink },
  listen: { flexDirection: "row", alignItems: "center", gap: 4 },
  listenText: { fontSize: 13, fontWeight: "800", color: colors.accent },
  rewrite: { fontSize: 16, lineHeight: 25, color: colors.ink },
  blurLines: { gap: 8, marginVertical: 4 },
  blurLine: { height: 12, borderRadius: 6, backgroundColor: colors.bgAlt },
  upgrade: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: colors.surface },
  upgradeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  upgradeEn: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: "700", color: colors.ink },
  upgradeVi: { fontSize: 13, lineHeight: 19, color: colors.ink },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  again: { marginTop: spacing.md },
  againHint: { fontSize: 12, color: colors.muted, textAlign: "center" },
  delete: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm },
  deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
});
