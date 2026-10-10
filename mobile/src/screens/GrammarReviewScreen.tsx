import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api, GrammarReviewItem, ReviewSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CountUp, DoneCelebration } from "../components/DoneCelebration";
import { GrammarQuiz } from "../components/grammar/GrammarQuiz";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { QuizItem, QuizResult, sampleExercises } from "../grammar/quiz";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";
import { shuffle } from "../utils/shuffle";

type Props = NativeStackScreenProps<RootStackParamList, "GrammarReview">;

/** Mixed sessions take a few questions per lesson; practicing one lesson takes a full quiz. */
const PER_LESSON_MIXED = 3;
const PER_LESSON_SINGLE = 8;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

type Outcome = { levelUp: number; withMistakes: number; pulled: number; relearn: { slug: string; titleVi: string }[] };

export function GrammarReviewScreen({ route, navigation }: Props) {
  const params = route.params ?? { mode: "due" };
  const practice = params.mode === "practice";
  const slug = practice ? params.slug : undefined;
  const { refreshMe } = useAuth();
  const [lessons, setLessons] = useState<GrammarReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [quiz, setQuiz] = useState<{ run: number; items: QuizItem[] }>({ run: 0, items: [] });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setOutcome(null);
    try {
      const [items, s] = await Promise.all([
        practice ? api.grammarPractice(slug, slug ? 1 : 4) : api.grammarReviewDue(),
        api.grammarReviewSummary(),
      ]);
      const perLesson = items.length === 1 ? PER_LESSON_SINGLE : PER_LESSON_MIXED;
      const quizItems = shuffle(
        items.flatMap((l) =>
          sampleExercises(l.exercises, perLesson).map((exercise) => ({
            key: `${l.slug}:${exercise.id}`,
            slug: l.slug,
            label: items.length > 1 ? l.titleVi : undefined,
            exercise,
          }))
        )
      );
      setLessons(items);
      setSummary(s);
      setQuiz((q) => ({ run: q.run + 1, items: quizItems }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bài ôn");
    } finally {
      setLoading(false);
    }
  }, [practice, slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function finish(result: QuizResult) {
    const clean = lessons.filter((l) => !result.mistakesBySlug[l.slug]).length;
    const next: Outcome = { levelUp: clean, withMistakes: lessons.length - clean, pulled: 0, relearn: [] };
    setOutcome(next);
    for (const l of lessons) {
      const mistakes = result.mistakesBySlug[l.slug] ?? 0;
      try {
        const res = practice
          ? await api.grammarPracticeAnswer(l.slug, mistakes)
          : await api.grammarReviewAnswer(l.slug, mistakes);
        if (res.pulledForward) next.pulled++;
        if (res.suggestRelearn) next.relearn.push({ slug: l.slug, titleVi: l.titleVi });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không lưu được kết quả");
      }
    }
    setOutcome({ ...next });
    refreshMe().catch(() => undefined);
  }

  const startPractice = () => navigation.replace("GrammarReview", { mode: "practice", title: "Luyện ngữ pháp" });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (quiz.items.length === 0) {
    const canPractice = (summary?.inReview ?? 0) > 0;
    return (
      <View style={[styles.center, styles.pad]}>
        <View style={styles.bigIcon}>
          <Ionicons name="leaf-outline" size={40} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>{practice ? "Chưa có bài để luyện" : "Không có bài ngữ pháp cần ôn"}</Text>
        <Text style={styles.doneSub}>
          {!canPractice
            ? "Hoàn thành bài học ngữ pháp (đúng từ 70%) để bài được đưa vào lịch ôn."
            : summary?.nextDueAt
              ? `Lần ôn tiếp theo: ngày ${formatDate(summary.nextDueAt)}. Bạn vẫn có thể luyện thêm.`
              : "Bạn vẫn có thể luyện thêm."}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {!practice && canPractice ? (
            <Pressable style={styles.primaryBtn} onPress={startPractice}>
              <Text style={styles.primaryBtnText}>Luyện thêm</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Quay lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (outcome) {
    return (
      <View style={[styles.center, styles.pad]}>
        <DoneCelebration perfect={lessons.length > 0 && outcome.withMistakes === 0} />
        <Text style={styles.doneTitle}>{practice ? "Xong lượt luyện" : "Xong bài ôn ngữ pháp"}</Text>
        <Text style={styles.doneSub}>
          {lessons.length} bài · {quiz.items.length} câu
        </Text>
        <View style={styles.summaryRow}>
          <Stat value={outcome.levelUp} label={practice ? "Không sai" : "Lên cấp"} />
          <Stat value={outcome.withMistakes} label={practice ? "Có sai" : "Ôn lại sớm"} />
        </View>
        {outcome.pulled > 0 ? (
          <Text style={styles.doneSub}>{outcome.pulled} bài sai nhiều đã được hẹn ôn lại vào ngày mai.</Text>
        ) : null}
        {outcome.relearn.length > 0 ? (
          <View style={styles.relearn}>
            <Text style={styles.relearnTitle}>Nên xem lại lý thuyết</Text>
            {outcome.relearn.map((r) => (
              <Pressable
                key={r.slug}
                style={styles.relearnItem}
                onPress={() => navigation.replace("GrammarLesson", { slug: r.slug, titleVi: r.titleVi })}
              >
                <Text style={styles.relearnText}>{r.titleVi}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={practice ? load : startPractice}>
            <Text style={styles.primaryBtnText}>{practice ? "Luyện tiếp" : "Luyện thêm"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Xong</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardScreen style={styles.root} contentContainerStyle={styles.content}>
      <GrammarQuiz key={quiz.run} items={quiz.items} onFinish={finish} />
    </KeyboardScreen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <CountUp value={value} style={styles.statValue} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  pad: { padding: spacing.lg },
  bigIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { marginTop: spacing.lg, fontSize: 24, fontWeight: "700", color: colors.ink, textAlign: "center" },
  doneSub: { marginTop: spacing.sm, color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  summaryRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: 18, backgroundColor: colors.surface },
  statValue: { fontSize: 28, fontWeight: "700", color: colors.accent },
  statLabel: { marginTop: 2, color: colors.muted, fontWeight: "600" },
  relearn: { alignSelf: "stretch", marginTop: spacing.md, padding: spacing.md, borderRadius: 18, backgroundColor: colors.dangerSoft, gap: 8 },
  relearnTitle: { fontWeight: "800", color: colors.danger },
  relearnItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  relearnText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  error: { color: colors.danger, marginTop: spacing.sm, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: spacing.xl },
  primaryBtn: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondaryBtn: { paddingVertical: 15, borderRadius: 16, alignItems: "center", borderWidth: 1.5, borderColor: colors.accent },
  secondaryBtnText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
});
