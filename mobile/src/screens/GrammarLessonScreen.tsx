import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, GrammarCompleteResult, GrammarDetail } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { GrammarQuiz } from "../components/grammar/GrammarQuiz";
import { TheoryView } from "../components/grammar/TheoryView";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { displayAnswer, QuizItem, QuizResult, sampleExercises } from "../grammar/quiz";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "GrammarLesson">;

type Phase = "theory" | "quiz" | "result";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function GrammarLessonScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { refreshMe } = useAuth();
  const insets = useSafeAreaInsets();
  const [lesson, setLesson] = useState<GrammarDetail | null>(null);
  const [phase, setPhase] = useState<Phase>("theory");
  const [quiz, setQuiz] = useState<{ run: number; items: QuizItem[] }>({ run: 0, items: [] });
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saved, setSaved] = useState<GrammarCompleteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLesson(await api.grammarLesson(slug));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được bài");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  function startQuiz() {
    if (!lesson) return;
    const items = sampleExercises(lesson.exercises, lesson.quizSize).map((exercise) => ({
      key: exercise.id,
      slug: lesson.slug,
      exercise,
    }));
    setQuiz((q) => ({ run: q.run + 1, items }));
    setResult(null);
    setSaved(null);
    setPhase("quiz");
  }

  async function finish(r: QuizResult) {
    setResult(r);
    setPhase("result");
    try {
      setSaved(await api.completeGrammar(slug, r.firstTryCorrect, r.total));
      await refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được kết quả");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!lesson) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Không có bài"}</Text>
      </View>
    );
  }

  if (phase === "quiz") {
    return (
      <KeyboardScreen style={styles.root} contentContainerStyle={styles.quizContent}>
        <GrammarQuiz key={quiz.run} items={quiz.items} onFinish={finish} />
      </KeyboardScreen>
    );
  }

  if (phase === "result" && result) {
    const pct = Math.round((result.firstTryCorrect / result.total) * 100);
    const passed = saved?.passed ?? pct >= 70;
    return (
      <ScrollView style={styles.root} contentContainerStyle={[styles.resultContent, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={[styles.bigIcon, !passed && styles.bigIconSoft]}>
          <Ionicons name={passed ? "trophy" : "refresh"} size={40} color={passed ? colors.white : colors.accent} />
        </View>
        <Text style={styles.resultTitle}>{passed ? "Hoàn thành bài học!" : "Cố thêm chút nữa nhé"}</Text>
        <Text style={styles.score}>
          {result.firstTryCorrect}/{result.total}
        </Text>
        <Text style={styles.scoreSub}>câu đúng ngay lần đầu · {pct}%</Text>
        <Text style={styles.resultNote}>
          {!saved
            ? ""
            : saved.addedToReview && saved.nextReviewAt
              ? `Bài đã được thêm vào lịch ôn. Lần ôn đầu: ngày ${formatDate(saved.nextReviewAt)}.`
              : passed
                ? "Bài này đang nằm trong lịch ôn của bạn."
                : "Đúng từ 70% số câu ngay lần đầu để đưa bài vào lịch ôn."}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result.missed.length > 0 ? (
          <View style={styles.missedCard}>
            <Text style={styles.missedTitle}>Câu cần xem lại</Text>
            {result.missed.map((m) => (
              <View key={m.key} style={styles.missedItem}>
                <Text style={styles.missedAnswer}>{displayAnswer(m.exercise)}</Text>
                <Text style={styles.missedExplain}>{m.exercise.explanationVi}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={startQuiz}>
            <Text style={styles.primaryBtnText}>Làm lại</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => setPhase("theory")}>
              <Text style={styles.secondaryBtnText}>Xem lý thuyết</Text>
            </Pressable>
            <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryBtnText}>Xong</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.theoryContent}>
        <View style={styles.hero}>
          <View style={styles.heroMeta}>
            <Text style={styles.level}>{lesson.level}</Text>
            {lesson.titleEn ? <Text style={styles.titleEn}>{lesson.titleEn}</Text> : null}
          </View>
          <Text style={styles.title}>{lesson.titleVi}</Text>
          <Text style={styles.summary}>{lesson.summaryVi}</Text>
        </View>
        <TheoryView sections={lesson.sections} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={startQuiz}>
          <Text style={styles.primaryBtnText}>
            Bắt đầu luyện tập · {Math.min(lesson.quizSize, lesson.exercises.length)} câu
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.sm },
  theoryContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.md },
  quizContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  hero: { gap: 6 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  level: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.white,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  titleEn: { fontSize: 14, fontWeight: "600", color: colors.muted },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  summary: { fontSize: 16, lineHeight: 23, color: colors.ink },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  primaryBtn: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  resultContent: { padding: spacing.lg, alignItems: "center" },
  bigIcon: {
    marginTop: spacing.lg,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  bigIconSoft: { backgroundColor: colors.accentSoft },
  resultTitle: { marginTop: spacing.lg, fontSize: 24, fontWeight: "700", color: colors.ink },
  score: { marginTop: spacing.sm, fontSize: 48, fontWeight: "800", color: colors.accent },
  scoreSub: { color: colors.muted, fontWeight: "600" },
  resultNote: { marginTop: spacing.md, fontSize: 15, color: colors.ink, textAlign: "center", lineHeight: 21 },
  missedCard: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: 12,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  missedTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  missedItem: { gap: 3, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  missedAnswer: { fontSize: 16, fontWeight: "700", color: colors.accent },
  missedExplain: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  actions: { alignSelf: "stretch", gap: 10, marginTop: spacing.xl },
  actionRow: { flexDirection: "row", gap: 10 },
});
