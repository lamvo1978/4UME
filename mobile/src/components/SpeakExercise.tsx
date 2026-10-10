import Ionicons from "@expo/vector-icons/Ionicons";
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import { ComponentProps, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api, ApiError, PhonemeScore, PronunciationResult, PronunciationStatus, Word } from "../api/client";
import { colors, spacing } from "../theme";
import { speak, stopSpeaking } from "./SpeakButton";

const MAX_SECONDS = 4;

/** 16 kHz mono is what the scorer uses; iOS records WAV directly, Android/web are converted on the server. */
const RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  ios: {
    extension: ".wav",
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: { ...RecordingPresets.HIGH_QUALITY.android, sampleRate: 16000 },
  web: { mimeType: "audio/webm", bitsPerSecond: 64000 },
};

type Phase = "idle" | "recording" | "checking" | "scored" | "compare" | "error";

export const scoreColor = (score: number) => (score >= 80 ? colors.accent : score >= 60 ? colors.flameDeep : colors.danger);
export const scoreSoft = (score: number) => (score >= 80 ? colors.accentSoft : score >= 60 ? colors.flameSoft : colors.dangerSoft);

export function verdict(score: number) {
  if (score >= 90) return "Rất chuẩn!";
  if (score >= 80) return "Tốt lắm!";
  if (score >= 60) return "Khá ổn, còn vài âm";
  return "Cần luyện thêm";
}

export function SpeakExercise({
  word,
  status,
  onStatus,
  onNext,
  onSkipAll,
}: {
  word: Word;
  status: PronunciationStatus | null;
  onStatus: (s: PronunciationStatus) => void;
  onNext: () => void;
  onSkipAll: () => void;
}) {
  const recorder = useAudioRecorder(RECORDING);
  const player = useAudioPlayer(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [message, setMessage] = useState("");
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const recording = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailed = !!status && status.remaining > 0;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (recording.current) {
        recording.current = false;
        void recorder.stop().catch(() => undefined);
      }
    },
    [],
  );

  async function start() {
    stopSpeaking();
    player.pause();
    setMessage("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMessage("Hãy cho phép 4UME dùng micro trong Cài đặt của máy để luyện phát âm.");
        setPhase("error");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      setPhase("recording");
      timer.current = setTimeout(() => void stop(), MAX_SECONDS * 1000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không bật được micro.");
      setPhase("error");
    }
  }

  async function stop() {
    if (!recording.current) return;
    recording.current = false;
    if (timer.current) clearTimeout(timer.current);
    try {
      await recorder.stop();
    } finally {
      // Back to playback mode, otherwise iOS keeps routing sound to the earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(
        () => undefined,
      );
    }
    const uri = recorder.uri;
    if (!uri) {
      setMessage("Không ghi được âm, bạn thử lại nhé.");
      setPhase("error");
      return;
    }
    setRecordingUri(uri);
    if (detailed) await check(uri);
    else setPhase("compare");
  }

  async function check(uri: string) {
    setPhase("checking");
    try {
      const r = await api.assessPronunciation(word.id, uri);
      setResult(r);
      onStatus(r.status);
      setPhase("scored");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 429 || e.status === 503) && status) {
        // Out of detailed checks (or the service is paused): fall back to comparing by ear.
        onStatus({ ...status, remaining: 0, serviceAvailable: e.status === 429 && status.serviceAvailable });
        setPhase("compare");
        return;
      }
      setMessage(e instanceof Error ? e.message : "Không chấm được, bạn thử lại nhé.");
      setPhase("error");
    }
  }

  function playMine() {
    if (!recordingUri) return;
    stopSpeaking();
    player.replace({ uri: recordingUri });
    player.play();
  }

  function playSample() {
    player.pause();
    speak(word.word);
  }

  function retry() {
    setResult(null);
    setRecordingUri(null);
    setPhase("idle");
  }

  return (
    <View style={styles.root}>
      <QuotaPill status={status} />

      {phase === "idle" || phase === "recording" ? (
        <View style={styles.micArea}>
          <Pressable
            onPress={phase === "idle" ? start : stop}
            style={({ pressed }) => [styles.mic, phase === "recording" && styles.micRecording, pressed && styles.pressed]}
          >
            <Ionicons name={phase === "recording" ? "stop" : "mic"} size={40} color={colors.white} />
          </Pressable>
          <Text style={styles.micHint}>
            {phase === "recording" ? "Đang ghi… chạm để dừng" : "Chạm vào micro rồi đọc to từ trên"}
          </Text>
          {phase === "idle" ? (
            <Pressable onPress={onSkipAll} hitSlop={8}>
              <Text style={styles.skip}>Không tiện nói lúc này</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {phase === "checking" ? (
        <View style={styles.micArea}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.micHint}>Đang chấm điểm…</Text>
        </View>
      ) : null}

      {phase === "scored" && result ? <ScoreCard word={word.word} result={result} onMine={playMine} onSample={playSample} /> : null}

      {phase === "compare" ? (
        <>
          <View style={styles.compareCard}>
            <Text style={styles.compareTitle}>Tự so sánh</Text>
            <Text style={styles.compareText}>Nghe giọng bạn rồi nghe giọng mẫu, xem đã giống chưa.</Text>
            <ListenRow onMine={playMine} onSample={playSample} />
          </View>
          <LockedDetail status={status} />
        </>
      ) : null}

      {phase === "error" ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{message}</Text>
        </View>
      ) : null}

      {phase === "scored" || phase === "compare" || phase === "error" ? (
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={retry}>
            <Ionicons name="refresh" size={18} color={colors.accent} />
            <Text style={styles.secondaryBtnText}>Đọc lại</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={onNext}>
            <Text style={styles.primaryBtnText}>Tiếp tục</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function QuotaPill({ status }: { status: PronunciationStatus | null }) {
  if (!status) return null;
  const detailed = status.remaining > 0;
  const text = detailed
    ? `${status.premium ? "Premium · c" : "C"}hấm chi tiết: còn ${status.remaining}/${status.dailyLimit} lượt hôm nay`
    : !status.serviceAvailable
      ? "Chấm chi tiết đang tạm dừng · tự so sánh giọng"
      : "Hết lượt chấm chi tiết hôm nay · tự so sánh giọng";
  return (
    <View style={[styles.pill, !detailed && styles.pillMuted]}>
      <Ionicons name={detailed ? "sparkles" : "ear-outline"} size={14} color={detailed ? colors.accent : colors.muted} />
      <Text style={[styles.pillText, !detailed && styles.pillTextMuted]}>{text}</Text>
    </View>
  );
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, "").trim();

function ScoreCard({
  word,
  result,
  onMine,
  onSample,
}: {
  word: string;
  result: PronunciationResult;
  onMine: () => void;
  onSample: () => void;
}) {
  const phonemes = result.words.flatMap((w) => w.phonemes);
  // Azure aligns the transcript to the reference text, so it usually echoes the word even when it was misread.
  const heardOther = !!result.heard && normalize(result.heard) !== normalize(word);
  const worst = phonemes.reduce<PhonemeScore | null>((min, p) => (!min || p.score < min.score ? p : min), null);
  const color = scoreColor(result.score);
  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreRow}>
        <View style={[styles.ring, { borderColor: color }]}>
          <Text style={[styles.ringValue, { color }]}>{result.score}</Text>
        </View>
        <View style={styles.scoreText}>
          <Text style={[styles.verdict, { color }]}>{verdict(result.score)}</Text>
          <Text style={styles.heard}>
            {heardOther ? `Máy nghe được: “${result.heard}”` : "Điểm chính xác so với giọng chuẩn"}
          </Text>
        </View>
      </View>

      {phonemes.length > 0 ? (
        <View style={styles.phonemes}>
          {phonemes.map((p, i) => (
            <View key={`${p.phoneme}-${i}`} style={[styles.phoneme, { backgroundColor: scoreSoft(p.score) }]}>
              <Text style={[styles.phonemeText, { color: scoreColor(p.score) }]}>/{p.phoneme}/</Text>
              <Text style={[styles.phonemeScore, { color: scoreColor(p.score) }]}>{p.score}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {worst && worst.score < 80 ? (
        <Text style={styles.tip}>
          Âm /{worst.phoneme}/ chưa chuẩn ({worst.score} điểm). Nghe lại giọng mẫu và chú ý âm này.
        </Text>
      ) : null}

      <ListenRow onMine={onMine} onSample={onSample} />
    </View>
  );
}

function ListenRow({ onMine, onSample }: { onMine: () => void; onSample: () => void }) {
  return (
    <View style={styles.listenRow}>
      <ListenButton icon="play" label="Giọng bạn" onPress={onMine} />
      <ListenButton icon="volume-high" label="Giọng mẫu" onPress={onSample} />
    </View>
  );
}

function ListenButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.listenBtn, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.listenText}>{label}</Text>
    </Pressable>
  );
}

/** What the detailed check would have shown, greyed out, so the free tier sees what it's missing. */
function LockedDetail({ status }: { status: PronunciationStatus | null }) {
  if (!status) return null;
  const text = !status.serviceAvailable
    ? "Chấm chi tiết đang tạm dừng, bạn quay lại sau nhé."
    : status.premium
      ? `Bạn đã dùng hết ${status.dailyLimit} lượt chấm chi tiết hôm nay. Lượt mới có vào ngày mai.`
      : `Bạn đã dùng hết ${status.dailyLimit} lượt miễn phí hôm nay. Lượt mới có vào ngày mai, hoặc dùng Premium để chấm ${status.premiumDailyLimit} lượt mỗi ngày.`;
  return (
    <View style={styles.locked}>
      <View style={styles.lockedHead}>
        <Ionicons name="lock-closed" size={16} color={colors.muted} />
        <Text style={styles.lockedTitle}>Chấm chi tiết từng âm</Text>
      </View>
      <View style={styles.lockedPreview}>
        <View style={styles.lockedRing}>
          <Text style={styles.lockedRingText}>?</Text>
        </View>
        <View style={styles.phonemes}>
          {["θ", "ɪ", "ŋ", "k"].map((p) => (
            <View key={p} style={styles.lockedPhoneme}>
              <Text style={styles.lockedPhonemeText}>/{p}/</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.lockedText}>Điểm 0–100, âm nào đọc sai được tô đỏ kèm gợi ý sửa. {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: colors.accentSoft,
  },
  pillMuted: { backgroundColor: colors.bgAlt },
  pillText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  pillTextMuted: { color: colors.muted },
  micArea: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  mic: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  micRecording: { backgroundColor: colors.danger },
  micHint: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  skip: { marginTop: spacing.sm, color: colors.muted, fontSize: 14, textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
  scoreCard: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, gap: spacing.md },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 6, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 24, fontWeight: "800" },
  scoreText: { flex: 1, gap: 4 },
  verdict: { fontSize: 18, fontWeight: "800" },
  heard: { fontSize: 14, color: colors.muted },
  phonemes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phoneme: { minWidth: 48, alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12 },
  phonemeText: { fontSize: 17, fontWeight: "700" },
  phonemeScore: { fontSize: 11, fontWeight: "700" },
  tip: { fontSize: 14, lineHeight: 20, color: colors.ink },
  listenRow: { flexDirection: "row", gap: 10 },
  listenBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  listenText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  compareCard: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, gap: spacing.sm },
  compareTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  compareText: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  locked: {
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  lockedHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  lockedTitle: { fontSize: 15, fontWeight: "800", color: colors.muted },
  lockedPreview: { flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: 0.55 },
  lockedRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 5,
    borderColor: colors.idle,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedRingText: { fontSize: 18, fontWeight: "800", color: colors.idle },
  lockedPhoneme: { minWidth: 44, alignItems: "center", paddingVertical: 6, borderRadius: 12, backgroundColor: colors.bgAlt },
  lockedPhonemeText: { fontSize: 15, fontWeight: "700", color: colors.idle },
  lockedText: { fontSize: 13, lineHeight: 19, color: colors.muted },
  errorCard: { backgroundColor: colors.dangerSoft, borderRadius: 16, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
});
