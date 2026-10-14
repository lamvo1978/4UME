import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setAudioModeAsync } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, PracticeSentence } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorRetry } from "../components/ErrorRetry";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { checkDictation, DictationResult, firstLetters } from "../listening/dictation";
import { useSentencePlayer } from "../listening/engines";
import { PracticeMode, RootStackParamList } from "../navigation/types";
import { speechToTextAvailable } from "../speech/useSpeechToText";
import { colors } from "../theme";
import { looksDictated, ResultCard, SpeakBox, styles, Tool } from "./DictationScreen";

type Score = { correct: number; total: number; perfect: boolean };

export function SentencePracticeScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, "SentencePractice">) {
  const { level, mode } = route.params;
  const [round, setRound] = useState<PracticeSentence[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError("");
    api
      .practiceSentences(level)
      .then(setRound)
      .catch((e) => setError(e instanceof Error ? e.message : "Không tải được câu luyện"));
  }, [level, attempt]);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(() => {});
  }, []);

  if (!round) {
    return <View style={styles.center}>{error ? <ErrorRetry message={error} onRetry={() => setAttempt((n) => n + 1)} /> : <ActivityIndicator color={colors.accent} />}</View>;
  }
  if (round.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.summaryText}>Cấp {level} chưa có câu luyện nào.</Text>
      </View>
    );
  }
  return (
    <Session
      key={route.key}
      round={round}
      mode={mode}
      onAgain={() => navigation.replace("SentencePractice", { level, mode })}
      onLeave={() => navigation.goBack()}
    />
  );
}

/** "mix" alternates, starting with typing; speaking needs the native speech module. */
function modeOf(mode: PracticeMode, index: number): "type" | "speak" {
  if (!speechToTextAvailable || mode === "type") return "type";
  if (mode === "speak") return "speak";
  return index % 2 === 0 ? "type" : "speak";
}

function Session({ round, mode, onAgain, onLeave }: { round: PracticeSentence[]; mode: PracticeMode; onAgain: () => void; onLeave: () => void }) {
  const insets = useSafeAreaInsets();
  const { refreshMe } = useAuth();
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [slow, setSlow] = useState(false);
  const [hint, setHint] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [typedOnly, setTypedOnly] = useState(false);
  const input = useRef<TextInput>(null);
  const recorded = useRef(new Set<number>());

  const done = pos >= round.length;
  const sentence = round[Math.min(pos, round.length - 1)];
  const speak = modeOf(mode, pos) === "speak";
  const { play, playing, loading } = useSentencePlayer(sentence.audioUrl, sentence.en);

  useEffect(() => {
    if (!done && !loading) play(false);
  }, [pos, done, loading, play]);

  useEffect(() => {
    if (done) refreshMe().catch(() => {});
  }, [done, refreshMe]);

  const check = useCallback(
    (said?: string) => {
      const r = checkDictation(sentence.en, said ?? answer);
      setResult(r);
      setScores((cur) => {
        const next = [...cur];
        const prev = next[pos];
        if (!prev || r.correct > prev.correct || (r.perfect && !prev.perfect)) next[pos] = { correct: r.correct, total: r.total, perfect: r.perfect };
        return next;
      });
      if (!recorded.current.has(pos)) {
        recorded.current.add(pos);
        api.recordPractice().catch(() => {});
      }
    },
    [sentence.en, answer, pos]
  );

  function retry() {
    setResult(null);
    if (!speak) setTimeout(() => input.current?.focus(), 50);
  }

  function next() {
    setResult(null);
    setAnswer("");
    setHint(false);
    setShowVi(false);
    setTypedOnly(false);
    setPos((p) => p + 1);
  }

  function type(text: string) {
    if (looksDictated(answer, text)) {
      setTypedOnly(true);
      return;
    }
    setTypedOnly(false);
    setAnswer(text);
  }

  if (done) return <Summary scores={scores} mode={mode} onAgain={onAgain} onLeave={onLeave} />;

  return (
    <KeyboardScreen contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${(pos / round.length) * 100}%` }]} />
        </View>
        <Text style={styles.count}>
          {pos + 1}/{round.length}
        </Text>
      </View>

      <View style={styles.card}>
        {mode === "mix" ? <Text style={styles.speaker}>{speak ? "Nghe – nói" : "Nghe – chép"}</Text> : null}
        <Pressable onPress={() => play(slow)} style={({ pressed }) => [styles.play, pressed && styles.pressed]} accessibilityLabel="Nghe lại câu">
          {loading ? <ActivityIndicator color={colors.white} /> : <Ionicons name={playing ? "volume-high" : "play"} size={34} color={colors.white} />}
        </Pressable>
        <Text style={styles.playLabel}>Chạm để nghe lại</Text>

        <View style={styles.tools}>
          <Tool
            icon="speedometer-outline"
            label="Chậm"
            on={slow}
            onPress={() => {
              setSlow(!slow);
              play(!slow);
            }}
          />
          <Tool icon={speak ? "document-text-outline" : "text-outline"} label={speak ? "Xem câu" : "Gợi ý"} on={hint} onPress={() => setHint(!hint)} />
          <Tool icon="language-outline" label="Nghĩa" on={showVi} onPress={() => setShowVi(!showVi)} />
        </View>
        {hint && !result ? <Text style={styles.hint}>{speak ? sentence.en : firstLetters(sentence.en)}</Text> : null}
        {showVi && !result ? <Text style={styles.vi}>{sentence.vi}</Text> : null}
      </View>

      {result ? (
        <ResultCard result={result} vi={sentence.vi} speak={speak} onRetry={retry} onNext={next} last={pos === round.length - 1} />
      ) : speak ? (
        <SpeakBox key={pos} names={[]} onSaid={check} />
      ) : (
        <>
          {typedOnly ? (
            <View style={styles.typedOnly}>
              <Ionicons name="hand-left-outline" size={16} color={colors.flameDeep} />
              <Text style={styles.typedOnlyText}>Phần chép cần tự gõ từng chữ, không đọc bằng giọng nói hay dán vào nhé.</Text>
            </View>
          ) : null}
          <TextInput
            key={pos}
            ref={input}
            style={styles.input}
            value={answer}
            onChangeText={type}
            placeholder="Gõ lại câu bạn nghe được…"
            placeholderTextColor={colors.idle}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            multiline
            submitBehavior="submit"
            returnKeyType="done"
            onSubmitEditing={() => check()}
          />
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => check()}>
            <Text style={styles.primaryText}>{answer.trim() ? "Kiểm tra" : "Xem đáp án"}</Text>
          </Pressable>
        </>
      )}
    </KeyboardScreen>
  );
}

function Summary({ scores, mode, onAgain, onLeave }: { scores: Score[]; mode: PracticeMode; onAgain: () => void; onLeave: () => void }) {
  const perfect = scores.filter((s) => s.perfect).length;
  const words = scores.reduce((n, s) => n + s.correct, 0);
  const total = scores.reduce((n, s) => n + s.total, 0);
  const percent = total ? Math.round((words / total) * 100) : 0;
  const good = percent >= 80;
  return (
    <View style={styles.summary}>
      <Ionicons name={good ? "trophy" : mode === "speak" ? "mic" : "create"} size={52} color={good ? colors.gold : colors.accent} />
      <Text style={styles.summaryTitle}>{good ? "Giỏi lắm!" : "Xong rồi!"}</Text>
      <Text style={styles.summaryText}>
        Đúng hoàn toàn {perfect}/{scores.length} câu · đúng {percent}% số từ
      </Text>
      <View style={styles.summaryActions}>
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onAgain}>
          <Text style={styles.primaryText}>Luyện 10 câu khác</Text>
        </Pressable>
        <Pressable onPress={onLeave} hitSlop={8}>
          <Text style={styles.link}>Đổi cấp độ hoặc chế độ</Text>
        </Pressable>
      </View>
    </View>
  );
}
