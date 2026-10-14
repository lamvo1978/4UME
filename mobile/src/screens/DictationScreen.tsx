import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextStyle, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorRetry } from "../components/ErrorRetry";
import { api, ListeningDetail } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { KeyboardScreen } from "../components/KeyboardScreen";
import {
  checkDictation,
  DictationResult,
  firstLetters,
  Marked,
  pickLines,
  ROUND_SIZE,
  TypedStatus,
  WordStatus,
} from "../listening/dictation";
import { useLinePlayer } from "../listening/engines";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Dictation">;

/** Best try of each sentence, for the summary. */
type Score = { correct: number; total: number; perfect: boolean };

export function DictationScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const [lesson, setLesson] = useState<ListeningDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError("");
    api
      .listeningLesson(slug)
      .then(setLesson)
      .catch((e) => setError(e instanceof Error ? e.message : "Không tải được bài nghe"));
  }, [slug, attempt]);

  if (!lesson) {
    return <View style={styles.center}>{error ? <ErrorRetry message={error} onRetry={() => setAttempt((n) => n + 1)} /> : <ActivityIndicator color={colors.accent} />}</View>;
  }
  return (
    <Session
      key={`${route.params.all ? "all" : "some"}-${route.key}`}
      lesson={lesson}
      all={!!route.params.all}
      onAgain={(all) => navigation.replace("Dictation", { slug, all })}
      onLeave={() => navigation.goBack()}
    />
  );
}

function Session({
  lesson,
  all,
  onAgain,
  onLeave,
}: {
  lesson: ListeningDetail;
  all: boolean;
  onAgain: (all: boolean) => void;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { refreshMe } = useAuth();
  const [queue] = useState(() => pickLines(lesson.slug, lesson.lines, all));
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [slow, setSlow] = useState(false);
  const [hint, setHint] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const input = useRef<TextInput>(null);
  const recorded = useRef(new Set<number>());
  const player = useLinePlayer(lesson.audioUrl, lesson.lines);

  const index = queue[pos];
  const line = lesson.lines[index];
  const done = pos >= queue.length;
  const speaker = lesson.speakers.length > 1 ? lesson.speakers.find((s) => s.key === line?.speaker)?.name : undefined;

  const { play, loading } = player;
  useEffect(() => {
    if (!done && !loading) play(index, false);
  }, [index, done, loading, play]);

  useEffect(() => {
    if (done) refreshMe().catch(() => {});
  }, [done, refreshMe]);

  const check = useCallback(() => {
    if (!line) return;
    const r = checkDictation(line.en, answer);
    setResult(r);
    setScores((cur) => {
      const next = [...cur];
      const prev = next[pos];
      if (!prev || r.correct > prev.correct || (r.perfect && !prev.perfect)) next[pos] = { correct: r.correct, total: r.total, perfect: r.perfect };
      return next;
    });
    if (!recorded.current.has(pos)) {
      recorded.current.add(pos);
      api.recordDictation(lesson.slug).catch(() => {});
    }
  }, [line, answer, pos, lesson.slug]);

  function retry() {
    setResult(null);
    setTimeout(() => input.current?.focus(), 50);
  }

  function next() {
    setResult(null);
    setAnswer("");
    setHint(false);
    setShowVi(false);
    setPos((p) => p + 1);
  }

  if (done) {
    return <Summary scores={scores} all={all} canMore={!all && lesson.lines.length > ROUND_SIZE} onAgain={onAgain} onLeave={onLeave} />;
  }

  return (
    <KeyboardScreen contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${(pos / queue.length) * 100}%` }]} />
        </View>
        <Text style={styles.count}>
          {pos + 1}/{queue.length}
        </Text>
      </View>

      <View style={styles.card}>
        {speaker ? <Text style={styles.speaker}>{speaker}</Text> : null}
        <Pressable
          onPress={() => play(index, slow)}
          style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          accessibilityLabel="Nghe lại câu"
        >
          {player.loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name={player.playing ? "volume-high" : "play"} size={34} color={colors.white} />
          )}
        </Pressable>
        <Text style={styles.playLabel}>Chạm để nghe lại</Text>

        <View style={styles.tools}>
          <Tool
            icon="speedometer-outline"
            label="Chậm"
            on={slow}
            onPress={() => {
              setSlow(!slow);
              play(index, !slow);
            }}
          />
          <Tool icon="text-outline" label="Gợi ý" on={hint} onPress={() => setHint(!hint)} />
          <Tool icon="language-outline" label="Nghĩa" on={showVi} onPress={() => setShowVi(!showVi)} />
        </View>
        {hint ? <Text style={styles.hint}>{firstLetters(line.en)}</Text> : null}
        {showVi && !result ? <Text style={styles.vi}>{line.vi}</Text> : null}
      </View>

      {result ? (
        <ResultCard result={result} vi={line.vi} onRetry={retry} onNext={next} last={pos === queue.length - 1} />
      ) : (
        <>
          <TextInput
            ref={input}
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Gõ lại câu bạn nghe được…"
            placeholderTextColor={colors.idle}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            multiline
            submitBehavior="submit"
            returnKeyType="done"
            onSubmitEditing={check}
          />
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={check}>
            <Text style={styles.primaryText}>{answer.trim() ? "Kiểm tra" : "Xem đáp án"}</Text>
          </Pressable>
        </>
      )}
    </KeyboardScreen>
  );
}

function Tool({ icon, label, on, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, on && styles.toolOn, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={on ? colors.white : colors.accent} />
      <Text style={[styles.toolText, on && styles.toolTextOn]}>{label}</Text>
    </Pressable>
  );
}

function verdict(r: DictationResult) {
  if (r.perfect) return { title: "Chính xác!", icon: "checkmark-circle" as const, color: colors.accent };
  if (r.correct === 0) return { title: "Nghe lại rồi thử nhé", icon: "refresh-circle" as const, color: colors.danger };
  if (r.correct === r.total) return { title: "Đủ từ rồi, chỉ gõ thừa", icon: "alert-circle" as const, color: colors.flameDeep };
  return { title: `Đúng ${r.correct}/${r.total} từ`, icon: "alert-circle" as const, color: colors.flameDeep };
}

/** One line per kind of mistake that actually happened, e.g. "1 từ gõ thừa — gạch ngang ở dòng bạn gõ". */
function mistakeNotes(r: DictationResult) {
  const inSentence = (s: WordStatus) => r.sentence.filter((w) => w.status === s).length;
  return [
    { n: inSentence("wrong"), color: colors.danger, text: "sai — tô đỏ" },
    { n: inSentence("close"), color: colors.flameDeep, text: "suýt đúng — sai chính tả một chút, tô cam" },
    { n: inSentence("missing"), color: colors.muted, text: "bị thiếu — nền xám trong đáp án" },
    { n: r.answer.filter((w) => w.status === "extra").length, color: colors.danger, text: "gõ thừa — gạch ngang ở dòng bạn gõ" },
  ].filter((x) => x.n > 0);
}

const ANSWER_STYLE: Record<TypedStatus, TextStyle> = {
  ok: {},
  close: { color: colors.flameDeep },
  wrong: { color: colors.danger, textDecorationLine: "underline" },
  extra: { color: colors.danger, textDecorationLine: "line-through" },
};

const SENTENCE_STYLE: Record<WordStatus, TextStyle> = {
  ok: { color: colors.accent },
  close: { color: colors.flameDeep },
  wrong: { color: colors.danger, textDecorationLine: "underline" },
  missing: { color: colors.muted, backgroundColor: colors.bgAlt, borderRadius: 6, overflow: "hidden", paddingHorizontal: 4 },
};

function MarkedLine<S extends string>({
  label,
  words,
  styleOf,
  empty,
}: {
  label: string;
  words: Marked<S>[];
  styleOf: Record<S, TextStyle>;
  empty?: string;
}) {
  return (
    <View style={styles.lineBlock}>
      <Text style={styles.lineLabel}>{label}</Text>
      {words.length ? (
        <View style={styles.words}>
          {words.map((w, i) => (
            <Text key={i} style={[styles.word, styleOf[w.status]]}>
              {w.text}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyAnswer}>{empty}</Text>
      )}
    </View>
  );
}

function ResultCard({
  result,
  vi,
  last,
  onRetry,
  onNext,
}: {
  result: DictationResult;
  vi: string;
  last: boolean;
  onRetry: () => void;
  onNext: () => void;
}) {
  const v = verdict(result);
  return (
    <View style={styles.result}>
      <View style={styles.verdict}>
        <Ionicons name={v.icon} size={22} color={v.color} />
        <Text style={[styles.verdictText, { color: v.color }]}>{v.title}</Text>
      </View>
      {!result.perfect ? <MarkedLine label="Bạn gõ" words={result.answer} styleOf={ANSWER_STYLE} empty="(bỏ trống)" /> : null}
      <MarkedLine label="Đáp án" words={result.sentence} styleOf={SENTENCE_STYLE} />
      {!result.perfect ? <Notes result={result} /> : null}
      {vi ? <Text style={styles.vi}>{vi}</Text> : null}
      <View style={styles.actions}>
        {!result.perfect ? (
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={onRetry}>
            <Text style={styles.secondaryText}>Sửa lại</Text>
          </Pressable>
        ) : null}
        <Pressable style={({ pressed }) => [styles.primary, styles.flex, pressed && styles.pressed]} onPress={onNext}>
          <Text style={styles.primaryText}>{last ? "Xem kết quả" : "Câu tiếp"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Notes({ result }: { result: DictationResult }) {
  return (
    <View style={styles.notes}>
      {mistakeNotes(result).map((x) => (
        <View key={x.text} style={styles.note}>
          <View style={[styles.dot, { backgroundColor: x.color }]} />
          <Text style={styles.noteText}>
            {x.n} từ {x.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Summary({
  scores,
  all,
  canMore,
  onAgain,
  onLeave,
}: {
  scores: Score[];
  all: boolean;
  canMore: boolean;
  onAgain: (all: boolean) => void;
  onLeave: () => void;
}) {
  const perfect = scores.filter((s) => s.perfect).length;
  const words = scores.reduce((n, s) => n + s.correct, 0);
  const total = scores.reduce((n, s) => n + s.total, 0);
  const percent = total ? Math.round((words / total) * 100) : 0;
  return (
    <View style={styles.summary}>
      <Ionicons name={percent >= 80 ? "trophy" : "create"} size={52} color={percent >= 80 ? colors.gold : colors.accent} />
      <Text style={styles.summaryTitle}>{percent >= 80 ? "Tai nghe tốt lắm!" : "Xong rồi!"}</Text>
      <Text style={styles.summaryText}>
        Chép đúng hoàn toàn {perfect}/{scores.length} câu · đúng {percent}% số từ
      </Text>
      <View style={styles.summaryActions}>
        {!all ? (
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => onAgain(false)}>
            <Text style={styles.primaryText}>{canMore ? `Chép ${ROUND_SIZE} câu khác` : "Chép lại"}</Text>
          </Pressable>
        ) : null}
        {canMore || all ? (
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => onAgain(true)}>
            <Text style={styles.secondaryText}>{all ? "Chép lại cả bài" : "Chép cả bài"}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onLeave} hitSlop={8}>
          <Text style={styles.link}>Về bài nghe</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.danger, textAlign: "center" },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.bg },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.bgAlt, overflow: "hidden" },
  trackFill: { height: 6, backgroundColor: colors.accent },
  count: { fontSize: 13, fontWeight: "700", color: colors.muted, fontVariant: ["tabular-nums"] },
  card: { alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, ...shadow.card },
  speaker: { fontSize: 12, fontWeight: "800", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  playLabel: { fontSize: 13, color: colors.muted },
  tools: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  toolOn: { backgroundColor: colors.accent },
  toolText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  toolTextOn: { color: colors.white },
  hint: { fontSize: 18, letterSpacing: 1, color: colors.ink, textAlign: "center", lineHeight: 28 },
  vi: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21 },
  input: {
    minHeight: 96,
    padding: spacing.md,
    paddingTop: spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
    textAlignVertical: "top",
  },
  primary: { alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: colors.accent },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
  },
  secondaryText: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  result: { gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, ...shadow.card },
  verdict: { flexDirection: "row", alignItems: "center", gap: 6 },
  verdictText: { fontSize: 17, fontWeight: "800" },
  lineBlock: { gap: 2 },
  lineLabel: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  words: { flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 2 },
  word: { fontSize: 19, lineHeight: 27, fontWeight: "600", color: colors.ink },
  emptyAnswer: { fontSize: 16, lineHeight: 27, color: colors.idle, fontStyle: "italic" },
  notes: { gap: 4, paddingTop: 2 },
  note: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  noteText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 18 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  summary: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bg },
  summaryTitle: { fontSize: 24, fontWeight: "800", color: colors.ink },
  summaryText: { fontSize: 15, color: colors.muted, textAlign: "center" },
  summaryActions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
  link: { color: colors.accent, fontSize: 15, fontWeight: "700", textAlign: "center", paddingVertical: spacing.sm },
});
