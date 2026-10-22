import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, VOCAB_LEVELS, VocabLevel, WritingHistory, WritingPrompt, WritingStatus } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorRetry } from "../components/ErrorRetry";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { formatDayMonthYear } from "../utils/dates";
import { scoreColor, wordRange } from "../writing/meta";

type IconName = keyof typeof Ionicons.glyphMap;

const iconOf = (name: string): IconName => (name in Ionicons.glyphMap ? (name as IconName) : "create-outline");

export function WritingHubScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "WritingHub">) {
  const { me } = useAuth();
  const [level, setLevel] = useState<VocabLevel>(me?.settings.vocabLevel ?? "A1");
  const [status, setStatus] = useState<WritingStatus | null>(null);
  const [prompts, setPrompts] = useState<WritingPrompt[] | null>(null);
  const [history, setHistory] = useState<WritingHistory | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const vocabLevel = me?.settings.vocabLevel;

  useEffect(() => {
    if (vocabLevel) setLevel(vocabLevel);
  }, [vocabLevel]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError("");
      Promise.all([api.writingStatus(), api.writingPrompts(), api.writingHistory()])
        .then(([s, list, h]) => {
          if (!active) return;
          setStatus(s);
          setPrompts(list);
          setHistory(h);
        })
        .catch((e) => active && setError(e instanceof Error ? e.message : "Không tải được phần luyện viết"));
      return () => {
        active = false;
      };
    }, [attempt])
  );

  if (error) return <View style={styles.center}><ErrorRetry message={error} onRetry={() => setAttempt((n) => n + 1)} /></View>;
  if (!status || !prompts || !history) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const blocked = !status.enabled || !status.available || status.remaining <= 0 || status.dayFull;
  const list = prompts.filter((p) => p.level === level);
  const countOf = (l: VocabLevel) => prompts.filter((p) => p.level === l).length;
  const [freeMin, freeMax] = wordRange(level);
  const write = (p: WritingPrompt | null) =>
    navigation.navigate("WritingEditor", p
      ? { promptId: p.id, level: p.level, title: p.titleVi, promptEn: p.promptEn, guideVi: p.guideVi, keyPhrases: p.keyPhrases, minWords: p.minWords, maxWords: p.maxWords }
      : { promptId: null, level, title: "Viết tự do" });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Viết một đoạn văn tiếng Anh, AI chấm điểm theo cấp độ, chỉ ra từng lỗi kèm giải thích tiếng Việt và gợi ý cách viết hay hơn.
      </Text>

      <QuotaNote status={status} onPremium={() => navigation.navigate("Premium")} />

      <Text style={styles.label}>Cấp độ</Text>
      <View style={styles.levels}>
        {VOCAB_LEVELS.map((l) => {
          const on = l === level;
          return (
            <Pressable key={l} onPress={() => setLevel(l)} style={[styles.level, on && styles.levelOn]}>
              <Text style={[styles.levelText, on && styles.levelTextOn]}>{l}</Text>
              <Text style={[styles.levelCount, on && styles.levelTextOn]}>{countOf(l)} đề</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        disabled={blocked}
        onPress={() => write(null)}
        style={({ pressed }) => [styles.card, styles.freeCard, blocked && styles.blocked, pressed && styles.pressed]}
      >
        <View style={[styles.icon, styles.freeIcon]}>
          <Ionicons name="create" size={24} color={colors.white} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Viết tự do</Text>
          <Text style={styles.text}>
            Tự chọn chủ đề, khoảng {freeMin}–{freeMax} từ cho cấp {level}.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Text style={styles.label}>Viết theo đề</Text>
      {list.length === 0 ? (
        <Text style={styles.empty}>Cấp {level} đang được soạn đề, bạn thử cấp khác hoặc viết tự do nhé.</Text>
      ) : (
        list.map((p) => (
          <Pressable
            key={p.id}
            disabled={blocked}
            onPress={() => write(p)}
            style={({ pressed }) => [styles.card, blocked && styles.blocked, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Ionicons name={iconOf(p.icon)} size={24} color={colors.accent} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{p.titleVi}</Text>
              <Text style={styles.text} numberOfLines={2}>
                {p.guideVi || p.promptEn}
              </Text>
              <Text style={styles.meta}>
                {p.minWords}–{p.maxWords} từ
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))
      )}

      {history.total > 0 ? (
        <>
          <Text style={styles.label}>Bài đã viết · {history.total}</Text>
          {history.items.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => navigation.navigate("WritingResult", { id: h.id })}
              style={({ pressed }) => [styles.card, styles.historyCard, pressed && styles.pressed]}
            >
              <View style={[styles.score, { borderColor: scoreColor(h.score) }]}>
                <Text style={[styles.scoreText, { color: scoreColor(h.score) }]}>{h.score}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={1}>
                  {h.title}
                </Text>
                <Text style={styles.text} numberOfLines={1}>
                  {h.excerpt}
                </Text>
                <Text style={styles.meta}>
                  {h.level} · {h.wordCount} từ · {formatDayMonthYear(h.createdAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
          {history.hidden > 0 ? (
            <Pressable onPress={() => navigation.navigate("Premium")} style={({ pressed }) => [styles.note, pressed && styles.pressed]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
              <Text style={styles.noteText}>
                Còn {history.hidden} bài cũ hơn. Gói miễn phí xem lại được {status.freeHistoryCount} bài gần nhất, Premium xem được tất cả.
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function QuotaNote({ status, onPremium }: { status: WritingStatus; onPremium: () => void }) {
  if (!status.enabled || !status.available) {
    return (
      <View style={styles.note}>
        <Ionicons name="construct-outline" size={18} color={colors.accent} />
        <Text style={styles.noteText}>Luyện viết với AI đang tạm dừng, bạn quay lại sau nhé.</Text>
      </View>
    );
  }
  if (status.remaining <= 0 || status.dayFull) {
    return (
      <View style={styles.lock}>
        <Ionicons name="time-outline" size={26} color={colors.accent} />
        <Text style={styles.lockTitle}>Hôm nay đã hết lượt chấm</Text>
        <Text style={styles.lockText}>
          {status.remaining <= 0
            ? status.premium
              ? "Bạn đã dùng hết lượt hôm nay, mai quay lại nhé."
              : `Gói miễn phí được chấm ${status.freeDailyLimit} bài mỗi ngày, Premium được ${status.premiumDailyLimit} bài.`
            : "Hôm nay 4UME đã chấm hết số bài dành cho gói miễn phí, bạn quay lại vào ngày mai nhé."}
        </Text>
        {!status.premium ? (
          <Pressable style={({ pressed }) => [styles.lockButton, pressed && styles.pressed]} onPress={onPremium}>
            <Text style={styles.lockButtonText}>Xem Premium</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.note}>
      <Ionicons name="create-outline" size={18} color={colors.accent} />
      <Text style={styles.noteText}>
        {status.premium ? "Premium · " : ""}Còn {status.remaining}/{status.dailyLimit} bài chấm hôm nay.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, backgroundColor: colors.bg, flexGrow: 1 },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  levels: { flexDirection: "row", gap: 8 },
  level: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: colors.bgAlt },
  levelOn: { backgroundColor: colors.accent },
  levelText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  levelCount: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  levelTextOn: { color: colors.white },
  note: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.accentSoft },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.ink },
  lock: { alignItems: "center", gap: 6, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.05 },
  lockTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  lockText: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: "center" },
  lockButton: { alignSelf: "stretch", alignItems: "center", marginTop: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent },
  lockButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  freeCard: { marginTop: spacing.sm },
  historyCard: { paddingVertical: 12 },
  blocked: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  freeIcon: { backgroundColor: colors.accent },
  score: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  scoreText: { fontSize: 16, fontWeight: "800" },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  text: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  meta: { fontSize: 11, fontWeight: "700", color: colors.muted },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
});
