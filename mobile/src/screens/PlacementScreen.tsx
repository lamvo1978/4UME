import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ComponentProps, ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, EasyWordMode, PlacementLevel, VOCAB_LEVELS, VocabLevel } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SpeakButton, stopSpeaking } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, shadow, spacing } from "../theme";
import { posLabel } from "../vocabulary/deckMeta";
import {
  answerPlacement,
  easierLabel,
  LEVEL_BLURB,
  levelRank,
  PlacementState,
  startPlacement,
} from "../vocabulary/placement";

type Props = NativeStackScreenProps<RootStackParamList, "Placement">;

/** How long the right / wrong colours stay before the next question. */
const FEEDBACK_MS = 650;

export function PlacementScreen({ navigation }: Props) {
  const { me, onboarding, applyPlacement, finishOnboarding } = useAuth();
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [levels, setLevels] = useState<PlacementLevel[]>([]);
  const [state, setState] = useState<PlacementState | null>(null);
  const [picked, setPicked] = useState<number | "skip" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      stopSpeaking();
    },
    []
  );

  async function start() {
    setLoading(true);
    setError("");
    try {
      const data = (await api.placementQuestions()).filter((l) => l.questions.length > 0);
      if (data.length === 0) throw new Error("Chưa có câu hỏi, hãy thử lại sau.");
      setLevels(data);
      setState(startPlacement(data));
      setPicked(null);
      setPhase("quiz");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bài kiểm tra");
    } finally {
      setLoading(false);
    }
  }

  function leave() {
    if (onboarding) {
      finishOnboarding();
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } else {
      navigation.goBack();
    }
  }

  async function apply(level: VocabLevel, mode: EasyWordMode, tested: boolean) {
    setLoading(true);
    setError("");
    try {
      const result = await applyPlacement(level, mode, tested);
      if (result.markedKnown > 0) {
        Alert.alert(
          "Đã cập nhật trình độ",
          `${result.markedKnown} từ ${easierLabel(level)} được tính là đã nhớ. Thỉnh thoảng chúng sẽ xuất hiện trong Ôn tập để kiểm tra lại.`
        );
      }
      leave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được kết quả");
      setLoading(false);
    }
  }

  function answer(choice: number | "skip") {
    if (!state || picked !== null) return;
    const q = levels[state.levelIndex].questions[state.questionIndex];
    setPicked(choice);
    timer.current = setTimeout(() => {
      const next = answerPlacement(state, levels, choice === q.answer);
      setState(next);
      setPicked(null);
      if (next.result) setPhase("result");
    }, FEEDBACK_MS);
  }

  if (phase === "intro") {
    return (
      <Shell onboarding={onboarding}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="school" size={40} color={colors.white} />
          </View>
          <Text style={styles.title}>Bạn biết bao nhiêu từ tiếng Anh?</Text>
          <Text style={styles.sub}>
            Trả lời vài câu chọn nghĩa, khoảng 2–3 phút. 4UME sẽ tìm cấp độ phù hợp để bạn không phải học lại những từ
            đã biết.
          </Text>
        </View>
        <View style={styles.points}>
          <Point icon="trending-up" text="Câu hỏi khó dần từ A1 đến B2, dừng khi bạn sai 2 câu ở một cấp" />
          <Point icon="help-circle-outline" text='Không chắc thì bấm "Không biết", đừng đoán để kết quả chính xác' />
          <Point icon="options-outline" text="Có thể đổi cấp độ hoặc làm lại bất cứ lúc nào trong Hồ sơ → Cài đặt" />
        </View>
        {!onboarding && me?.settings.easyWordMode === "known" ? (
          <Text style={styles.note}>
            Khi lưu kết quả mới, các từ lần trước được tự đánh dấu "đã nhớ" mà bạn chưa ôn lần nào sẽ được tính lại. Từ
            bạn tự học vẫn giữ nguyên.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={start} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Bắt đầu kiểm tra</Text>
            )}
          </Pressable>
          {onboarding ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => apply("A1", "skip", false)}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Tôi mới bắt đầu học</Text>
            </Pressable>
          ) : null}
        </View>
      </Shell>
    );
  }

  if (phase === "quiz" && state) {
    const level = levels[state.levelIndex];
    const q = level.questions[state.questionIndex];
    const score = state.scores[state.levelIndex];
    return (
      <Shell onboarding={onboarding}>
        <View style={styles.steps}>
          {state.scores.map((s, i) => (
            <View key={s.level} style={styles.step}>
              <View
                style={[
                  styles.stepBar,
                  s.passed && styles.stepBarDone,
                  i === state.levelIndex && styles.stepBarActive,
                ]}
              />
              <Text style={[styles.stepLabel, i === state.levelIndex && styles.stepLabelActive]}>{s.level}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.instruction}>Chọn nghĩa đúng</Text>
          <Text style={styles.word}>{q.word}</Text>
          <View style={styles.ipaRow}>
            {q.ipa ? <Text style={styles.ipa}>{q.ipa}</Text> : null}
            <SpeakButton text={q.word} size="sm" />
          </View>
          <Text style={styles.pos}>{posLabel(q.pos)}</Text>
        </View>

        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const revealed = picked !== null;
            const isAnswer = i === q.answer;
            const isPicked = picked === i;
            return (
              <Pressable
                key={`${q.wordId}-${i}`}
                disabled={revealed}
                onPress={() => answer(i)}
                style={({ pressed }) => [
                  styles.option,
                  revealed && isAnswer && styles.optionCorrect,
                  revealed && isPicked && !isAnswer && styles.optionWrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.optionText}>{opt}</Text>
                {revealed && isAnswer ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                {revealed && isPicked && !isAnswer ? <Ionicons name="close-circle" size={22} color={colors.danger} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            disabled={picked !== null}
            onPress={() => answer("skip")}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>Không biết</Text>
          </Pressable>
        </View>
        <Text style={styles.tally}>
          Cấp {level.level}: đúng {score.correct} · sai {score.wrong}
        </Text>
      </Shell>
    );
  }

  if (phase === "result" && state?.result) {
    return (
      <ResultView
        onboarding={onboarding}
        suggested={state.result}
        initialMode={me?.settings.easyWordMode ?? "skip"}
        scores={state.scores}
        loading={loading}
        error={error}
        onRetry={start}
        onApply={(level, mode) => apply(level, mode, true)}
      />
    );
  }

  return null;
}

function ResultView({
  onboarding,
  suggested,
  initialMode,
  scores,
  loading,
  error,
  onRetry,
  onApply,
}: {
  onboarding: boolean;
  suggested: VocabLevel;
  initialMode: EasyWordMode;
  scores: PlacementState["scores"];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onApply: (level: VocabLevel, mode: EasyWordMode) => void;
}) {
  const [level, setLevel] = useState<VocabLevel>(suggested);
  const [mode, setMode] = useState<EasyWordMode>(initialMode);
  const easier = easierLabel(level);

  return (
    <Shell onboarding={onboarding}>
      <View style={styles.hero}>
        <Text style={styles.resultKicker}>Cấp độ phù hợp với bạn</Text>
        <View style={styles.resultBadge}>
          <Text style={styles.resultLevel}>{suggested}</Text>
        </View>
        <Text style={styles.sub}>{LEVEL_BLURB[suggested]}</Text>
      </View>

      <View style={styles.scoreRow}>
        {scores
          .filter((s) => s.passed !== null)
          .map((s) => (
            <View key={s.level} style={[styles.scoreChip, s.passed ? styles.scoreChipOk : styles.scoreChipBad]}>
              <Ionicons
                name={s.passed ? "checkmark-circle" : "close-circle"}
                size={16}
                color={s.passed ? colors.accent : colors.danger}
              />
              <Text style={styles.scoreText}>
                {s.level} · {s.correct}/{s.correct + s.wrong}
              </Text>
            </View>
          ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bắt đầu học từ cấp</Text>
        <View style={styles.levelRow}>
          {VOCAB_LEVELS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLevel(l)}
              style={({ pressed }) => [styles.levelPill, level === l && styles.levelPillActive, pressed && styles.pressed]}
            >
              <Text style={[styles.levelPillText, level === l && styles.levelPillTextActive]}>{l}</Text>
              {l === suggested ? (
                <Text style={[styles.levelPillHint, level === l && styles.levelPillHintActive]}>đề xuất</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {levelRank(level) > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Với các từ {easier} dễ hơn</Text>
          <ModeCard
            active={mode === "skip"}
            icon="play-skip-forward-outline"
            title="Bỏ qua (khuyên dùng)"
            text={`Từ ${easier} xếp cuối mỗi bộ từ. Bạn vẫn học được khi muốn.`}
            onPress={() => setMode("skip")}
          />
          <ModeCard
            active={mode === "known"}
            icon="checkmark-done-outline"
            title="Đánh dấu đã nhớ"
            text={`Từ ${easier} tính là đã nhớ, thỉnh thoảng xuất hiện trong Ôn tập để kiểm tra lại.`}
            onPress={() => setMode("known")}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => onApply(level, levelRank(level) > 0 ? mode : "skip")}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Bắt đầu học</Text>}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={onRetry} disabled={loading}>
          <Text style={styles.secondaryBtnText}>Làm lại bài kiểm tra</Text>
        </Pressable>
      </View>
    </Shell>
  );
}

/** Onboarding has no stack header, so it owns the safe area; from Profile the header is there. */
function Shell({ onboarding, children }: { onboarding: boolean; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.root} edges={onboarding ? ["top", "bottom"] : ["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

type IconName = ComponentProps<typeof Ionicons>["name"];

function Point({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

function ModeCard({
  active,
  icon,
  title,
  text,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mode, active && styles.modeActive, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeText}>{text}</Text>
      </View>
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? colors.accent : colors.idle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  hero: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: colors.ink, textAlign: "center" },
  sub: { fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: "center" },
  points: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, gap: spacing.md, ...shadow.card },
  point: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  pointText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink },
  note: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: "center" },
  actions: { gap: 10, marginTop: "auto", paddingTop: spacing.md },
  primaryBtn: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center", minHeight: 54 },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondaryBtn: { paddingVertical: 15, borderRadius: 16, alignItems: "center", borderWidth: 1.5, borderColor: colors.accent },
  secondaryBtnText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger, textAlign: "center" },
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, gap: 4, alignItems: "center" },
  stepBar: { alignSelf: "stretch", height: 6, borderRadius: 3, backgroundColor: colors.accentSoft },
  stepBarDone: { backgroundColor: colors.accent },
  stepBarActive: { backgroundColor: colors.flame },
  stepLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  stepLabelActive: { color: colors.flameDeep },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.lg, alignItems: "center", gap: 6, ...shadow.card },
  instruction: { color: colors.muted, fontWeight: "600" },
  word: { fontSize: 38, fontWeight: "700", color: colors.ink, textAlign: "center", marginTop: spacing.xs },
  ipaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ipa: { fontSize: 17, color: colors.muted },
  pos: { fontSize: 14, color: colors.muted },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionCorrect: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionText: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.ink },
  skip: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: spacing.lg },
  skipText: { fontSize: 16, fontWeight: "700", color: colors.muted, textDecorationLine: "underline" },
  tally: { textAlign: "center", fontSize: 13, color: colors.muted },
  resultKicker: { fontSize: 15, fontWeight: "700", color: colors.muted },
  resultBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  resultLevel: { fontFamily: fonts.display, fontSize: 40, fontWeight: "700", color: colors.white },
  scoreRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  scoreChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99 },
  scoreChipOk: { backgroundColor: colors.accentSoft },
  scoreChipBad: { backgroundColor: colors.dangerSoft },
  scoreText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  levelRow: { flexDirection: "row", gap: 8 },
  levelPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  levelPillActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  levelPillText: { fontSize: 17, fontWeight: "800", color: colors.ink },
  levelPillTextActive: { color: colors.white },
  levelPillHint: { fontSize: 11, fontWeight: "600", color: colors.accent },
  levelPillHintActive: { color: colors.accentSoft },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  modeText: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.muted },
});
