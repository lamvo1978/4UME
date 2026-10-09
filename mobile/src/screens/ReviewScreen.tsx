import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, mediaUrl, ReviewItem, ReviewSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { LetterTiles } from "../components/LetterTiles";
import { MatchPairs } from "../components/MatchPairs";
import { SentenceBuilder, sentenceTokens } from "../components/SentenceBuilder";
import { SpeakButton, speak, speakAuto, stopSpeaking } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { posLabel } from "../vocabulary/deckMeta";
import { shuffle } from "../utils/shuffle";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

const MAX_LEVEL = 6;
const MATCH_MIN = 3;
const MATCH_MAX = 5;

type ExerciseType =
  | "meaning_choice"
  | "word_choice"
  | "image_choice"
  | "matching"
  | "letters_listen"
  | "letters_meaning"
  | "sentence";

type Exercise = { key: string; type: ExerciseType; items: ReviewItem[] };

type Feedback = { correct: boolean; given: string | null; reason: "ok" | "wrong" | "hints" | "revealed" };

const INSTRUCTIONS: Record<ExerciseType, string> = {
  meaning_choice: "Chọn nghĩa đúng",
  word_choice: "Chọn từ tiếng Anh đúng",
  image_choice: "Nhìn hình và chọn từ đúng",
  matching: "Nối từ với nghĩa",
  letters_listen: "Nghe và ráp lại từ",
  letters_meaning: "Ráp từ tiếng Anh theo nghĩa",
  sentence: "Sắp xếp thành câu đúng",
};

const letterCount = (s: string) => s.replace(/[^a-z]/gi, "").length;

/** Tile puzzles get tedious for long phrases and trivial for 1–2 letters. */
const suitsTiles = (word: string) => letterCount(word) >= 3 && letterCount(word) <= 12;

const suitsSentence = (example: string) => {
  const n = sentenceTokens(example).length;
  return n >= 3 && n <= 10;
};

const SESSION_TARGET = 18;
const SESSION_MAX = 20;
const MAX_PER_WORD = 4;

/** Easier exercises are shown before harder ones for the same word. */
const DIFFICULTY: Record<ExerciseType, number> = {
  meaning_choice: 0,
  image_choice: 1,
  matching: 1,
  word_choice: 2,
  letters_meaning: 3,
  letters_listen: 4,
  sentence: 5,
};

/** Higher-level words skip the easy recognition exercises. */
function eligibleTypes(it: ReviewItem): ExerciseType[] {
  const types: ExerciseType[] = [];
  if (it.level <= 2) types.push("meaning_choice");
  if (it.level <= 4 || !suitsTiles(it.word.word)) types.push("word_choice");
  if (it.level <= 4 && it.word.imageUrl) types.push("image_choice");
  if (suitsTiles(it.word.word)) types.push("letters_listen", "letters_meaning");
  if (suitsSentence(it.word.example)) types.push("sentence");
  return types;
}

/**
 * Each word gets a few randomly picked exercise types (enough to land near
 * SESSION_TARGET in total), and one matching exercise covers several words.
 * Exercises are dealt in rounds — every word's easiest pick first, then the
 * next — so the same word comes back in a harder form a few minutes later.
 */
function buildPlan(items: ReviewItem[]): Exercise[] {
  if (items.length === 0) return [];
  const matched = new Set(
    items.length >= MATCH_MIN ? shuffle(items).slice(0, MATCH_MAX).map((it) => it.word.id) : [],
  );
  const singles = SESSION_TARGET - (matched.size > 0 ? 1 : 0) + matched.size;
  const perWord = Math.min(MAX_PER_WORD, Math.max(1, Math.round(singles / items.length)));

  // Matched words already practise in round 0 via the matching exercise, so their singles start at round 1.
  const picks = items.map((it) => {
    const pool = shuffle(eligibleTypes(it));
    const inMatching = matched.has(it.word.id);
    const singles = pool
      .slice(0, Math.min(inMatching ? perWord - 1 : perWord, pool.length))
      .sort((a, b) => DIFFICULTY[a] - DIFFICULTY[b])
      .map((type): Exercise | null => ({ key: `${type}-${it.word.id}`, type, items: [it] }));
    return inMatching ? [null, ...singles] : singles;
  });

  const rounds: Exercise[][] = [];
  for (let r = 0; picks.some((p) => p.length > r); r++) {
    rounds.push(picks.flatMap((p) => p[r] ?? []));
  }
  if (matched.size > 0) {
    (rounds[0] ??= []).push({ key: "matching", type: "matching", items: items.filter((it) => matched.has(it.word.id)) });
  }
  rounds.forEach((round, i) => (rounds[i] = shuffle(round)));

  const plan: Exercise[] = [];
  for (const round of rounds) {
    const last = plan[plan.length - 1];
    const clash = round.findIndex((e) => !last || !sharesWord(e, last));
    if (clash > 0) [round[0], round[clash]] = [round[clash], round[0]];
    plan.push(...round);
  }
  return plan.slice(0, SESSION_MAX);
}

const sharesWord = (a: Exercise, b: Exercise) =>
  a.items.some((x) => b.items.some((y) => y.word.id === x.word.id));

function expected(ex: Exercise) {
  const word = ex.items[0].word;
  if (ex.type === "meaning_choice") return word.meaningVi;
  if (ex.type === "sentence") return sentenceTokens(word.example).join(" ");
  return word.word;
}

/** Using hints on more than half the pieces means the answer wasn't really recalled. */
function hintLimit(ex: Exercise) {
  const word = ex.items[0].word;
  const pieces = ex.type === "sentence" ? sentenceTokens(word.example).length : letterCount(word.word);
  return Math.floor(pieces / 2);
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const EMPTY_STATS = { words: 0, clean: 0, withMistakes: 0, relearn: 0, pulled: 0 };

export function ReviewScreen({ navigation, route }: Props) {
  const { refreshMe } = useAuth();
  const params = route.params ?? { mode: "due" };
  const practice = params.mode === "practice";
  const deckId = practice ? params.deckId : undefined;
  const wordIds = practice ? params.wordIds : undefined;
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mistakes = useRef<Record<string, number>>({});
  const retries = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [items, s] = await Promise.all([
        practice ? api.practiceItems({ deckId, wordIds }) : api.reviewDue(),
        api.reviewSummary(),
      ]);
      const plan = buildPlan(items);
      setSummary(s);
      setQueue(plan);
      setTotal(plan.length);
      setDone(0);
      setFeedback(null);
      setStats({ ...EMPTY_STATS, words: items.length });
      mistakes.current = {};
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bài ôn tập");
    } finally {
      setLoading(false);
    }
  }, [practice, deckId, wordIds?.join(",")]);

  const startPractice = () => navigation.replace("Review", { mode: "practice", title: "Luyện thêm" });

  useEffect(() => {
    load();
    return () => stopSpeaking();
  }, [load]);

  const ex = queue[0];

  useEffect(() => {
    if (ex?.type === "letters_listen") speak(ex.items[0].word.word);
  }, [ex?.key]);

  function addMistake(wordId: string) {
    mistakes.current[wordId] = (mistakes.current[wordId] ?? 0) + 1;
  }

  async function finishWord(wordId: string) {
    const count = mistakes.current[wordId] ?? 0;
    setStats((s) => (count === 0 ? { ...s, clean: s.clean + 1 } : { ...s, withMistakes: s.withMistakes + 1 }));
    try {
      if (practice) {
        const res = await api.practiceAnswer(wordId, count);
        if (res.pulledForward) setStats((s) => ({ ...s, pulled: s.pulled + 1 }));
      } else {
        const res = await api.reviewAnswer(wordId, count);
        if (res.backToLearning) setStats((s) => ({ ...s, relearn: s.relearn + 1 }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được kết quả");
    }
  }

  function complete(result: Feedback) {
    if (!ex || feedback) return;
    setFeedback(result);
    if (ex.type !== "matching") speakAuto(ex.items[0].word.word);
    if (!result.correct) {
      ex.items.forEach((it) => addMistake(it.word.id));
      return;
    }
    const rest = queue.slice(1);
    ex.items
      .filter((it) => !rest.some((e) => e.items.some((x) => x.word.id === it.word.id)))
      .forEach((it) => finishWord(it.word.id));
  }

  function check(answer: string, hintsUsed: number) {
    if (!ex) return;
    const matches = normalize(answer) === normalize(expected(ex));
    if (matches && hintsUsed > hintLimit(ex)) complete({ correct: false, given: answer, reason: "hints" });
    else complete({ correct: matches, given: answer, reason: matches ? "ok" : "wrong" });
  }

  function next() {
    if (!ex || !feedback) return;
    stopSpeaking();
    const rest = queue.slice(1);
    if (feedback.correct) {
      setDone((d) => d + 1);
      setQueue(rest);
      if (rest.length === 0) refreshMe();
    } else {
      retries.current += 1;
      setQueue([...rest, { ...ex, key: `${ex.key}-retry${retries.current}` }]);
    }
    setFeedback(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const canPractice = (summary?.inReview ?? 0) > 0;

  if (total === 0) {
    return (
      <View style={[styles.center, styles.pad]}>
        <View style={styles.bigIcon}>
          <Ionicons name="leaf-outline" size={40} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>{practice ? "Chưa có từ để luyện" : "Hôm nay không có từ cần ôn"}</Text>
        <Text style={styles.doneSub}>
          {!canPractice
            ? 'Bấm "Đã nhớ" khi học từ vựng, từ đó sẽ xuất hiện ở đây để ôn lại.'
            : practice
              ? "Chưa có từ đã nhớ phù hợp để luyện."
              : `Đang theo dõi ${summary!.inReview} từ${
                  summary!.nextDueAt ? ` · lần ôn tiếp theo ngày ${formatDate(summary!.nextDueAt)}` : ""
                }. Bạn vẫn có thể luyện thêm.`}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.doneActions}>
          {!practice && canPractice ? (
            <Pressable style={styles.primaryBtn} onPress={startPractice}>
              <Text style={styles.primaryBtnText}>Luyện thêm 10 từ</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={!practice && canPractice ? styles.secondaryBtn : styles.primaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={!practice && canPractice ? styles.secondaryBtnText : styles.primaryBtnText}>Quay lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!ex) {
    return (
      <View style={[styles.center, styles.pad]}>
        <View style={styles.bigIcon}>
          <Ionicons name={practice ? "flash" : "ribbon-outline"} size={40} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>{practice ? "Xong lượt luyện" : "Xong bài ôn hôm nay"}</Text>
        <Text style={styles.doneSub}>
          Đã {practice ? "luyện" : "ôn"} {stats.words} từ qua {total} bài tập.
        </Text>
        <View style={styles.summaryRow}>
          <SummaryStat value={String(stats.clean)} label={practice ? "Không sai" : "Lên cấp"} />
          <SummaryStat value={String(stats.withMistakes)} label={practice ? "Có sai" : "Ôn lại sớm"} />
        </View>
        {stats.relearn > 0 ? (
          <Text style={styles.doneSub}>{stats.relearn} từ sai nhiều lần liên tiếp đã được đưa về "Học sau".</Text>
        ) : null}
        {stats.pulled > 0 ? (
          <Text style={styles.doneSub}>{stats.pulled} từ sai nhiều đã được hẹn ôn lại vào ngày mai.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.doneActions}>
          <Pressable style={styles.primaryBtn} onPress={practice ? load : startPractice}>
            <Text style={styles.primaryBtnText}>
              {!practice ? "Luyện thêm 10 từ" : wordIds?.length ? "Luyện lại" : "Luyện tiếp"}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Xong</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const item = ex.items[0];
  const answerText = expected(ex);
  const options = ex.type === "meaning_choice" ? item.meaningOptions : item.wordOptions;
  const reveal = () => complete({ correct: false, given: null, reason: "revealed" });

  return (
    <KeyboardScreen style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.progressRow}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${(done / total) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {done}/{total}
        </Text>
      </View>

      {ex.type === "matching" ? (
        <>
          <Text style={styles.matchTitle}>{INSTRUCTIONS.matching}</Text>
          <MatchPairs
            key={ex.key}
            pairs={ex.items.map((it) => ({ id: it.word.id, word: it.word.word, meaning: it.word.meaningVi }))}
            onMistake={addMistake}
            onDone={() => complete({ correct: true, given: null, reason: "ok" })}
          />
        </>
      ) : (
        <View style={styles.card}>
          <View style={styles.levelRow}>
            {Array.from({ length: MAX_LEVEL - 1 }, (_, i) => (
              <View key={i} style={[styles.levelDot, i < item.level && styles.levelDotOn]} />
            ))}
            <Text style={styles.levelText}>Cấp {Math.min(item.level, MAX_LEVEL - 1)}</Text>
          </View>
          <Text style={styles.instruction}>{INSTRUCTIONS[ex.type]}</Text>
          <Prompt ex={ex} />
        </View>
      )}

      {ex.type === "letters_listen" || ex.type === "letters_meaning" ? (
        <LetterTiles key={ex.key} word={item.word.word} locked={!!feedback} onCheck={check} onReveal={reveal} />
      ) : ex.type === "sentence" ? (
        <SentenceBuilder key={ex.key} sentence={item.word.example} locked={!!feedback} onCheck={check} onReveal={reveal} />
      ) : ex.type !== "matching" ? (
        <View style={styles.options}>
          {options.map((opt) => {
            const isAnswer = opt === answerText;
            const isPicked = feedback?.given === opt;
            return (
              <Pressable
                key={opt}
                disabled={!!feedback}
                onPress={() => complete({ correct: isAnswer, given: opt, reason: isAnswer ? "ok" : "wrong" })}
                style={({ pressed }) => [
                  styles.option,
                  feedback && isAnswer && styles.optionCorrect,
                  feedback && isPicked && !isAnswer && styles.optionWrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.optionText}>{opt}</Text>
                {feedback && isAnswer ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                {feedback && isPicked && !isAnswer ? (
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {feedback ? (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackOk : styles.feedbackBad]}>
          <Text style={[styles.feedbackTitle, { color: feedback.correct ? colors.accent : colors.danger }]}>
            {feedback.correct
              ? ex.type === "matching"
                ? "Nối đúng hết!"
                : "Chính xác!"
              : feedback.reason === "hints"
                ? "Đúng, nhưng dùng nhiều gợi ý"
                : feedback.reason === "revealed"
                  ? "Đáp án"
                  : "Chưa đúng"}
          </Text>
          {ex.type !== "matching" ? (
            <>
              <View style={styles.feedbackWordRow}>
                <Text style={styles.feedbackWord}>{item.word.word}</Text>
                {item.word.ipa ? <Text style={styles.feedbackIpa}>{item.word.ipa}</Text> : null}
                <SpeakButton text={item.word.word} size="sm" />
              </View>
              <Text style={styles.feedbackMeaning}>{item.word.meaningVi}</Text>
              {item.word.forms ? <Text style={styles.feedbackForms}>{item.word.forms}</Text> : null}
              {item.word.example ? <Text style={styles.feedbackExample}>{item.word.example}</Text> : null}
            </>
          ) : null}
          {!feedback.correct ? (
            <Text style={styles.feedbackNote}>Câu này sẽ quay lại ở cuối bài để bạn làm lại.</Text>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>Tiếp tục</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardScreen>
  );
}

function Prompt({ ex }: { ex: Exercise }) {
  const word = ex.items[0].word;
  switch (ex.type) {
    case "meaning_choice":
      return (
        <View style={styles.prompt}>
          <Text style={styles.promptWord}>{word.word}</Text>
          <View style={styles.ipaRow}>
            {word.ipa ? <Text style={styles.ipa}>{word.ipa}</Text> : null}
            <SpeakButton text={word.word} />
          </View>
        </View>
      );
    case "letters_listen":
      return (
        <View style={styles.prompt}>
          <SpeakButton text={word.word} size="lg" />
          <Text style={styles.promptHint}>{posLabel(word.pos)}</Text>
        </View>
      );
    case "word_choice":
    case "letters_meaning":
      return (
        <View style={styles.prompt}>
          <Text style={styles.promptMeaning}>{word.meaningVi}</Text>
          <Text style={styles.promptHint}>{posLabel(word.pos)}</Text>
        </View>
      );
    case "sentence":
      return (
        <View style={styles.prompt}>
          <Text style={styles.promptSentence}>{word.exampleVi || `Câu có từ "${word.word}"`}</Text>
        </View>
      );
    case "image_choice":
      return <ImagePrompt ex={ex} />;
    case "matching":
      return null;
  }
}

/** Falls back to the Vietnamese meaning if the image fails to load. */
function ImagePrompt({ ex }: { ex: Exercise }) {
  const word = ex.items[0].word;
  const [failed, setFailed] = useState(false);
  if (!word.imageUrl || failed) {
    return (
      <View style={styles.prompt}>
        <Text style={styles.promptMeaning}>{word.meaningVi}</Text>
      </View>
    );
  }
  return (
    <View style={styles.prompt}>
      <Image
        source={{ uri: mediaUrl(word.imageUrl)! }}
        style={styles.promptImage}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  pad: { padding: spacing.lg },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barBg: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.accentSoft, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 99, backgroundColor: colors.accent },
  progressText: { fontWeight: "700", color: colors.accent, minWidth: 48, textAlign: "right" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    alignItems: "center",
    ...shadow.card,
  },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  levelDot: { width: 18, height: 5, borderRadius: 3, backgroundColor: colors.accentSoft },
  levelDotOn: { backgroundColor: colors.accent },
  levelText: { marginLeft: 6, fontSize: 12, fontWeight: "700", color: colors.muted },
  instruction: { marginTop: spacing.md, color: colors.muted, fontWeight: "600" },
  matchTitle: { fontSize: 20, fontWeight: "700", color: colors.ink, marginTop: spacing.sm },
  prompt: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md, minHeight: 110, justifyContent: "center" },
  promptWord: { fontSize: 40, fontWeight: "700", color: colors.ink },
  promptMeaning: { fontSize: 28, fontWeight: "700", color: colors.accent, textAlign: "center" },
  promptSentence: { fontSize: 20, lineHeight: 28, fontWeight: "600", color: colors.ink, textAlign: "center" },
  promptHint: { color: colors.muted, fontSize: 15, textAlign: "center" },
  ipaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ipa: { fontSize: 18, color: colors.muted },
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
  pressed: { opacity: 0.7 },
  promptImage: { width: 240, height: 170, borderRadius: 18, backgroundColor: colors.bgAlt },
  feedback: { borderRadius: 20, padding: spacing.md, gap: 6 },
  feedbackOk: { backgroundColor: colors.accentSoft },
  feedbackBad: { backgroundColor: colors.dangerSoft },
  feedbackTitle: { fontSize: 18, fontWeight: "800" },
  feedbackWordRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  feedbackWord: { fontSize: 20, fontWeight: "700", color: colors.ink },
  feedbackIpa: { fontSize: 15, color: colors.muted },
  feedbackMeaning: { fontSize: 16, fontWeight: "600", color: colors.ink },
  feedbackForms: { fontSize: 14, fontWeight: "700", color: colors.flameDeep },
  feedbackExample: { fontSize: 15, color: colors.muted, fontStyle: "italic" },
  feedbackNote: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  doneActions: { alignSelf: "stretch", gap: 10, marginTop: spacing.xl },
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
  summaryStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  summaryValue: { fontSize: 28, fontWeight: "700", color: colors.accent },
  summaryLabel: { marginTop: 2, color: colors.muted, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.sm, textAlign: "center" },
});
