import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, GrammarDetail } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "GrammarLesson">;

type Exercise = GrammarDetail["exercises"][number] & { answer?: string };

export function GrammarLessonScreen({ route }: Props) {
  const { slug } = route.params;
  const { refreshMe } = useAuth();
  const [lesson, setLesson] = useState<(Omit<GrammarDetail, "exercises"> & { exercises: Exercise[] }) | null>(
    null
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [score, setScore] = useState<{ score: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLesson((await api.grammarLesson(slug)) as typeof lesson);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được bài");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (error || !lesson) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Không có bài"}</Text>
      </View>
    );
  }

  const exercise = lesson.exercises[index];

  async function onNext() {
    if (!lesson || !exercise) return;
    const given = (answers[exercise.id] ?? "").trim();
    const expected = (exercise.answer ?? "").trim();
    const correct = expected.length > 0 && given.toLowerCase() === expected.toLowerCase();
    setFeedback({
      correct,
      text: correct
        ? `Đúng — ${exercise.explanation}`
        : `Sai — đáp án: ${expected}. ${exercise.explanation}`,
    });

    const isLast = index >= lesson.exercises.length - 1;
    setTimeout(async () => {
      setFeedback(null);
      if (!isLast) {
        setIndex((i) => i + 1);
        return;
      }
      const payload = lesson.exercises.map((e) => ({
        exerciseId: e.id,
        answer: answers[e.id] ?? "",
      }));
      const result = await api.submitGrammar(slug, payload);
      setScore({ score: result.score, total: result.total });
      await refreshMe();
    }, 800);
  }

  if (score) {
    return (
      <View style={styles.center}>
        <Text style={styles.scoreTitle}>Hoàn thành</Text>
        <Text style={styles.score}>
          {score.score}/{score.total}
        </Text>
        <Text style={styles.meta}>{lesson.titleVi}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{lesson.titleVi}</Text>
      <Text style={styles.summary}>{lesson.summaryVi}</Text>
      <Text style={styles.formula}>{lesson.formula}</Text>
      <Text style={styles.example}>{lesson.example}</Text>
      <Text style={styles.mistake}>Lỗi hay gặp: {lesson.commonMistakeVi}</Text>

      <View style={styles.quiz}>
        <Text style={styles.qIndex}>
          Câu {index + 1}/{lesson.exercises.length}
        </Text>
        <Text style={styles.prompt}>{exercise.prompt}</Text>
        {exercise.options?.length ? (
          exercise.options.map((opt) => {
            const selected = answers[exercise.id] === opt;
            return (
              <Pressable
                key={opt}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setAnswers((a) => ({ ...a, [exercise.id]: opt }))}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
              </Pressable>
            );
          })
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Điền đáp án"
            placeholderTextColor={colors.muted}
            value={answers[exercise.id] ?? ""}
            onChangeText={(t) => setAnswers((a) => ({ ...a, [exercise.id]: t }))}
            autoCapitalize="none"
          />
        )}
        {feedback ? (
          <Text style={[styles.feedback, feedback.correct ? styles.ok : styles.bad]}>
            {feedback.text}
          </Text>
        ) : null}
        <Pressable style={styles.primary} onPress={onNext}>
          <Text style={styles.primaryText}>
            {index < lesson.exercises.length - 1 ? "Câu tiếp" : "Nộp bài"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink },
  summary: { marginTop: 8, color: colors.ink, lineHeight: 22 },
  formula: {
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    padding: 12,
    borderRadius: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  example: { marginTop: spacing.sm, color: colors.muted, fontStyle: "italic" },
  mistake: { marginTop: spacing.sm, color: colors.muted },
  quiz: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  qIndex: { color: colors.muted, fontWeight: "600" },
  prompt: { fontSize: 18, fontWeight: "700", color: colors.ink },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionText: { color: colors.ink, fontSize: 16 },
  optionTextSelected: { color: colors.accent, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  primary: {
    marginTop: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  feedback: { marginTop: 4 },
  ok: { color: colors.accent },
  bad: { color: "#8B3A2A" },
  scoreTitle: { fontSize: 22, color: colors.muted },
  score: { fontSize: 48, fontWeight: "700", color: colors.accent, marginVertical: 8 },
  meta: { color: colors.ink },
  error: { color: "#8B3A2A" },
});
