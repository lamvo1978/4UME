import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GrammarExercise } from "../../api/client";
import { displayAnswer, isCorrect, parseErrorSentence, QuizItem, QuizResult } from "../../grammar/quiz";
import { colors, shadow, spacing } from "../../theme";
import { SentenceBuilder, sentenceTokens } from "../SentenceBuilder";
import { SpeakButton } from "../SpeakButton";

type Feedback = { correct: boolean; given: string | null; reason: "ok" | "wrong" | "hints" | "revealed" };

const INSTRUCTIONS: Record<GrammarExercise["type"], string> = {
  mcq: "Chọn đáp án đúng",
  fill: "Điền vào chỗ trống",
  order: "Sắp xếp thành câu đúng",
  transform: "Đổi câu",
  error: "Chạm vào từ sai trong câu",
};

/**
 * Duolingo-style run: a wrong answer shows the solution and the question comes back at the end.
 * Remount (via `key`) to start a new run.
 */
export function GrammarQuiz({ items, onFinish }: { items: QuizItem[]; onFinish: (result: QuizResult) => void }) {
  const [queue, setQueue] = useState(items);
  const [done, setDone] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [typed, setTyped] = useState("");
  const missedKeys = useRef(new Set<string>());
  const missed = useRef<QuizItem[]>([]);
  const mistakes = useRef<Record<string, number>>({});
  const retries = useRef(0);

  const item = queue[0];
  if (!item) return null;
  const ex = item.exercise;
  const baseKey = item.key.split("#")[0];

  function complete(result: Feedback) {
    if (feedback) return;
    setFeedback(result);
    if (result.correct) return;
    mistakes.current[item.slug] = (mistakes.current[item.slug] ?? 0) + 1;
    if (!missedKeys.current.has(baseKey)) {
      missedKeys.current.add(baseKey);
      missed.current.push(item);
    }
  }

  function check(given: string, hintsUsed = 0) {
    const ok = isCorrect(ex, given);
    const pieces = ex.type === "order" || ex.type === "transform" ? sentenceTokens(ex.answer).length : 0;
    if (ok && hintsUsed > Math.floor(pieces / 2)) complete({ correct: false, given, reason: "hints" });
    else complete({ correct: ok, given, reason: ok ? "ok" : "wrong" });
  }

  const reveal = () => complete({ correct: false, given: null, reason: "revealed" });

  function next() {
    if (!feedback) return;
    const rest = queue.slice(1);
    setFeedback(null);
    setTyped("");
    if (feedback.correct) {
      setDone((d) => d + 1);
      if (rest.length === 0) {
        onFinish({
          total: items.length,
          firstTryCorrect: items.length - missedKeys.current.size,
          mistakesBySlug: mistakes.current,
          missed: missed.current,
        });
        return;
      }
      setQueue(rest);
    } else {
      retries.current += 1;
      setQueue([...rest, { ...item, key: `${baseKey}#${retries.current}` }]);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${(done / items.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {done}/{items.length}
        </Text>
      </View>

      <View style={styles.card}>
        {item.label ? <Text style={styles.label}>{item.label}</Text> : null}
        <Text style={styles.instruction}>{ex.type === "transform" ? ex.instructionVi : INSTRUCTIONS[ex.type]}</Text>
        <Prompt ex={ex} />
        {ex.type === "error" ? (
          <ErrorTokens key={item.key} ex={ex} feedback={feedback} onPick={(ok) => complete({ correct: ok, given: ok ? "correct" : "wrong", reason: ok ? "ok" : "wrong" })} />
        ) : null}
      </View>

      {ex.type === "mcq" ? (
        <View style={styles.options}>
          {ex.options.map((opt) => {
            const isAnswer = opt === ex.answer;
            const isPicked = feedback?.given === opt;
            return (
              <Pressable
                key={opt}
                disabled={!!feedback}
                onPress={() => check(opt)}
                style={({ pressed }) => [
                  styles.option,
                  feedback && isAnswer && styles.optionCorrect,
                  feedback && isPicked && !isAnswer && styles.optionWrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.optionText}>{opt}</Text>
                {feedback && isAnswer ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                {feedback && isPicked && !isAnswer ? <Ionicons name="close-circle" size={22} color={colors.danger} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {ex.type === "fill" ? (
        <View style={styles.fillBox}>
          <TextInput
            style={[styles.input, feedback && (feedback.correct ? styles.inputCorrect : styles.inputWrong)]}
            value={typed}
            onChangeText={setTyped}
            placeholder="Gõ đáp án"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!feedback}
            returnKeyType="done"
            onSubmitEditing={() => typed.trim() && check(typed)}
          />
          {!feedback ? (
            <View style={styles.fillActions}>
              <Pressable onPress={reveal} style={({ pressed }) => [styles.revealBtn, pressed && styles.pressed]} hitSlop={6}>
                <Ionicons name="eye-outline" size={18} color={colors.accent} />
                <Text style={styles.revealText}>Xem đáp án</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.flex, !typed.trim() && styles.disabled]}
                disabled={!typed.trim()}
                onPress={() => check(typed)}
              >
                <Text style={styles.primaryBtnText}>Kiểm tra</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {ex.type === "order" || ex.type === "transform" ? (
        <SentenceBuilder
          key={item.key}
          sentence={ex.answer}
          distractors={ex.distractors}
          locked={!!feedback}
          onCheck={check}
          onReveal={reveal}
        />
      ) : null}

      {ex.type === "error" && !feedback ? (
        <Pressable onPress={reveal} style={({ pressed }) => [styles.revealCenter, pressed && styles.pressed]} hitSlop={6}>
          <Ionicons name="eye-outline" size={18} color={colors.accent} />
          <Text style={styles.revealText}>Xem đáp án</Text>
        </Pressable>
      ) : null}

      {feedback ? (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackOk : styles.feedbackBad]}>
          <Text style={[styles.feedbackTitle, { color: feedback.correct ? colors.accent : colors.danger }]}>
            {feedback.correct
              ? "Chính xác!"
              : feedback.reason === "hints"
                ? "Đúng, nhưng dùng nhiều gợi ý"
                : feedback.reason === "revealed"
                  ? "Đáp án"
                  : "Chưa đúng"}
          </Text>
          <View style={styles.answerRow}>
            <Text style={styles.answerText}>{displayAnswer(ex)}</Text>
            <SpeakButton text={displayAnswer(ex)} size="sm" />
          </View>
          <Text style={styles.explanation}>{ex.explanationVi}</Text>
          {!feedback.correct ? <Text style={styles.note}>Câu này sẽ quay lại ở cuối bài để bạn làm lại.</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>Tiếp tục</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Prompt({ ex }: { ex: GrammarExercise }) {
  switch (ex.type) {
    case "mcq":
    case "fill":
      return <Text style={styles.prompt}>{ex.prompt.replace(/_{3,}/g, "_____")}</Text>;
    case "order":
      return <Text style={styles.promptVi}>{ex.promptVi}</Text>;
    case "transform":
      return <Text style={styles.prompt}>{ex.source}</Text>;
    case "error":
      return null;
  }
}

function ErrorTokens({
  ex,
  feedback,
  onPick,
}: {
  ex: Extract<GrammarExercise, { type: "error" }>;
  feedback: Feedback | null;
  onPick: (correct: boolean) => void;
}) {
  const { tokens, wrongIndex } = parseErrorSentence(ex.sentence);
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <View style={styles.tokens}>
      {tokens.map((t, i) => {
        const isWrongWord = i === wrongIndex;
        return (
          <Pressable
            key={i}
            disabled={!!feedback}
            onPress={() => {
              setPicked(i);
              onPick(isWrongWord);
            }}
            style={({ pressed }) => [
              styles.token,
              feedback && isWrongWord && styles.tokenTarget,
              feedback && picked === i && !isWrongWord && styles.tokenMiss,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tokenText, feedback && isWrongWord && styles.tokenTargetText]}>{t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barBg: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.accentSoft, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 99, backgroundColor: colors.accent },
  progressText: { fontWeight: "700", color: colors.accent, minWidth: 48, textAlign: "right" },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
  label: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  instruction: { color: colors.muted, fontWeight: "600" },
  prompt: { fontSize: 22, lineHeight: 31, fontWeight: "700", color: colors.ink },
  promptVi: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: colors.accent },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionCorrect: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionText: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.ink },
  fillBox: { gap: 10 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    fontSize: 20,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  inputCorrect: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  inputWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  fillActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  revealBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  revealCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  revealText: { color: colors.accent, fontWeight: "700" },
  tokens: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.xs },
  token: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.border,
  },
  tokenTarget: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  tokenMiss: { backgroundColor: colors.bgAlt, borderColor: colors.muted },
  tokenText: { fontSize: 18, fontWeight: "600", color: colors.ink },
  tokenTargetText: { color: colors.danger, textDecorationLine: "line-through" },
  feedback: { borderRadius: 20, padding: spacing.md, gap: 6 },
  feedbackOk: { backgroundColor: colors.accentSoft },
  feedbackBad: { backgroundColor: colors.dangerSoft },
  feedbackTitle: { fontSize: 18, fontWeight: "800" },
  answerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  answerText: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink },
  explanation: { fontSize: 15, lineHeight: 21, color: colors.ink },
  note: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  primaryBtn: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
