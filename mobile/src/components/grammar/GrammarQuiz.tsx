import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextStyle, View } from "react-native";
import { GrammarExercise, VerbNote } from "../../api/client";
import {
  clozeGapCorrect,
  displayAnswer,
  isCorrect,
  parseErrorSentence,
  QuizItem,
  QuizResult,
  splitCloze,
  verbFor,
} from "../../grammar/quiz";
import { tokenize } from "../../listening/meta";
import { colors, shadow, spacing } from "../../theme";
import { WordSheet } from "../listening/WordSheet";
import { SentenceBuilder, sentenceTokens } from "../SentenceBuilder";
import { SpeakButton } from "../SpeakButton";
import { MicButton } from "../../speech/MicButton";

type Feedback = { correct: boolean; given: string | null; reason: "ok" | "wrong" | "hints" | "revealed" };

const INSTRUCTIONS: Record<GrammarExercise["type"], string> = {
  mcq: "Chọn đáp án đúng",
  fill: "Điền vào chỗ trống",
  order: "Sắp xếp thành câu đúng",
  transform: "Đổi câu",
  error: "Chạm vào từ sai trong câu",
  cloze: "Điền vào đoạn văn",
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
  const [gaps, setGaps] = useState<string[]>([]);
  const [lookup, setLookup] = useState<{ word: string; verb: VerbNote | null } | null>(null);
  const missedKeys = useRef(new Set<string>());
  const missed = useRef<QuizItem[]>([]);
  const mistakes = useRef<Record<string, number>>({});
  const retries = useRef(0);

  const item = queue[0];
  if (!item) return null;
  const ex = item.exercise;
  const baseKey = item.key.split("#")[0];
  const lookUp = (word: string, shown: string) => setLookup({ word, verb: verbFor(ex.verbs, word, shown, !!feedback) });

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
    setGaps([]);
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
        <Prompt ex={ex} gaps={gaps} checked={!!feedback} onWord={lookUp} />
        {ex.type === "error" ? (
          <ErrorTokens key={item.key} ex={ex} feedback={feedback} onPick={(ok) => complete({ correct: ok, given: ok ? "correct" : "wrong", reason: ok ? "ok" : "wrong" })} />
        ) : null}
        {ex.type !== "order" && ex.type !== "error" ? (
          <View style={styles.lookupHint}>
            <Ionicons name="book-outline" size={13} color={colors.muted} />
            <Text style={styles.lookupHintText}>Chạm vào một từ để xem nghĩa</Text>
          </View>
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
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.flex, feedback && (feedback.correct ? styles.inputCorrect : styles.inputWrong)]}
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
            {!feedback ? <MicButton onText={setTyped} size={44} /> : null}
          </View>
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

      {ex.type === "cloze" ? (
        <ClozeInputs key={item.key} ex={ex} values={gaps} onChange={setGaps} feedback={feedback} onCheck={check} onReveal={reveal} />
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
            <LookupText text={displayAnswer(ex)} style={styles.answerText} onWord={lookUp} />
            <SpeakButton text={displayAnswer(ex)} size="sm" />
          </View>
          <Text style={styles.explanation}>{ex.explanationVi}</Text>
          {!feedback.correct ? <Text style={styles.note}>Câu này sẽ quay lại ở cuối bài để bạn làm lại.</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>Tiếp tục</Text>
          </Pressable>
        </View>
      ) : null}
      <WordSheet word={lookup?.word ?? null} verb={lookup?.verb} onClose={() => setLookup(null)} />
    </View>
  );
}

/** English text whose words open the word sheet when tapped. */
function LookupText({ text, style, onWord }: { text: string; style?: TextStyle; onWord: (word: string, shown: string) => void }) {
  return (
    <Text style={style}>
      {tokenize(text).map((t, k) =>
        t.word ? (
          <Text key={k} onPress={() => onWord(t.word!, text)}>
            {t.text}
          </Text>
        ) : (
          t.text
        )
      )}
    </Text>
  );
}

const NBSP = "\u00A0";

function Prompt({
  ex,
  gaps,
  checked,
  onWord,
}: {
  ex: GrammarExercise;
  gaps: string[];
  checked: boolean;
  onWord: (word: string, shown: string) => void;
}) {
  switch (ex.type) {
    case "mcq":
    case "fill":
      return <LookupText text={ex.prompt.replace(/_{3,}/g, "_____")} style={styles.prompt} onWord={onWord} />;
    case "order":
      return <Text style={styles.promptVi}>{ex.promptVi}</Text>;
    case "transform":
      return <LookupText text={ex.source} style={styles.prompt} onWord={onWord} />;
    case "error":
      return null;
    case "cloze": {
      const { parts, hints } = splitCloze(ex.prompt);
      return (
        <Text style={styles.paragraph}>
          {parts.map((text, i) => {
            const value = gaps[i]?.trim();
            const ok = checked ? clozeGapCorrect(ex.blanks[i] ?? [], gaps[i] ?? "") : null;
            return (
              <Text key={i}>
                <LookupText text={text} onWord={onWord} />
                {i < hints.length ? (
                  // Non-breaking spaces keep the number, the blank and its hint on one line.
                  <Text>
                    <Text style={[styles.gap, value ? styles.gapFilled : null, ok === true && styles.gapOk, ok === false && styles.gapBad]}>
                      <Text style={styles.gapNum}>{`${NBSP}${i + 1}${NBSP}`}</Text>
                      {`${value ? value.replace(/ /g, NBSP) : "______"}${NBSP}`}
                    </Text>
                    {hints[i] && !value ? <Text style={styles.gapHint}>{`${NBSP}(${hints[i]})`}</Text> : null}
                  </Text>
                ) : null}
              </Text>
            );
          })}
        </Text>
      );
    }
  }
}

function ClozeInputs({
  ex,
  values,
  onChange,
  feedback,
  onCheck,
  onReveal,
}: {
  ex: Extract<GrammarExercise, { type: "cloze" }>;
  values: string[];
  onChange: (values: string[]) => void;
  feedback: Feedback | null;
  onCheck: (given: string) => void;
  onReveal: () => void;
}) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const { hints } = splitCloze(ex.prompt);
  const all = ex.blanks.map((_, i) => values[i] ?? "");
  const setValue = (i: number, t: string) => onChange(all.map((v, j) => (j === i ? t : v)));
  const filled = all.every((v) => v.trim());
  const submit = () => filled && onCheck(JSON.stringify(all));

  return (
    <View style={styles.fillBox}>
      {ex.blanks.map((accepted, i) => {
        const ok = clozeGapCorrect(accepted, all[i]);
        return (
          <View key={i} style={styles.gapRow}>
            <Text style={styles.gapNumber}>{i + 1}</Text>
            <View style={styles.flex}>
              <View style={styles.inputRow}>
                <TextInput
                  ref={(r) => {
                    inputs.current[i] = r;
                  }}
                  style={[styles.input, styles.gapInput, styles.flex, feedback && (ok ? styles.inputCorrect : styles.inputWrong)]}
                  value={all[i]}
                  onChangeText={(t) => setValue(i, t)}
                  placeholder={hints[i] ? `(${hints[i]})` : `Chỗ trống ${i + 1}`}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!feedback}
                  returnKeyType={i < ex.blanks.length - 1 ? "next" : "done"}
                  blurOnSubmit={i === ex.blanks.length - 1}
                  onSubmitEditing={() => (i < ex.blanks.length - 1 ? inputs.current[i + 1]?.focus() : submit())}
                />
                {!feedback ? <MicButton onText={(t) => setValue(i, t)} size={38} /> : null}
              </View>
              {feedback && !ok ? <Text style={styles.gapAnswer}>{accepted[0]}</Text> : null}
            </View>
          </View>
        );
      })}
      {!feedback ? (
        <View style={styles.fillActions}>
          <Pressable onPress={onReveal} style={({ pressed }) => [styles.revealBtn, pressed && styles.pressed]} hitSlop={6}>
            <Ionicons name="eye-outline" size={18} color={colors.accent} />
            <Text style={styles.revealText}>Xem đáp án</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, styles.flex, !filled && styles.disabled]} disabled={!filled} onPress={submit}>
            <Text style={styles.primaryBtnText}>Kiểm tra</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
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
  paragraph: { fontSize: 17, lineHeight: 27, color: colors.ink },
  gap: { fontWeight: "700", color: colors.flameDeep, backgroundColor: colors.bg },
  gapNum: { color: colors.flameDeep },
  gapFilled: { color: colors.ink, backgroundColor: colors.accentSoft },
  gapOk: { color: colors.accent, backgroundColor: colors.accentSoft },
  gapBad: { color: colors.danger, backgroundColor: colors.dangerSoft },
  gapHint: { fontWeight: "600", color: colors.muted },
  lookupHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  lookupHintText: { fontSize: 12, color: colors.muted },
  gapRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  gapNumber: { width: 24, paddingTop: 10, fontSize: 16, fontWeight: "700", color: colors.flameDeep, textAlign: "center" },
  gapInput: { paddingVertical: 9, fontSize: 17, borderRadius: 14, textAlign: "left" },
  gapAnswer: { marginTop: 4, marginLeft: 4, fontSize: 15, fontWeight: "700", color: colors.accent },
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
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
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
