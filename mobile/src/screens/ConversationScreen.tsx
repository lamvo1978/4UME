import Ionicons from "@expo/vector-icons/Ionicons";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setAudioModeAsync } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  api,
  ApiError,
  ConversationScenario,
  ConversationStatus,
  ConversationSummary,
  ConversationTurn,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorRetry } from "../components/ErrorRetry";
import { randomVoice, SpeakButton, speakRecording, stopSpeaking } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { MicButton } from "../speech/MicButton";
import { colors, shadow, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Conversation">;

/** Server limit for one message. */
const MAX_TEXT = 300;

export function ConversationScreen({ route, navigation }: Props) {
  const { scenarioId, level } = route.params;
  const [id, setId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ConversationScenario | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [status, setStatus] = useState<ConversationStatus | null>(null);
  const [error, setError] = useState("");
  const [outOfTurns, setOutOfTurns] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  /** The phone's voice for this talk: picked at random once, so the AI keeps sounding like the same person. */
  const [voice, setVoice] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([api.startConversation(scenarioId, level), randomVoice()])
      .then(([r, picked]) => {
        if (!active) return;
        setVoice(picked);
        setId(r.id);
        setScenario(r.scenario);
        setTurns([r.opening]);
        setStatus(r.status);
        speakRecording(r.opening.audioUrl, r.opening.text, picked);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 429) setOutOfTurns(true);
        else setError(e instanceof Error ? e.message : "Chưa bắt đầu được buổi đàm thoại");
      });
    return () => {
      active = false;
    };
  }, [scenarioId, level, attempt]);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(() => {});
    return () => stopSpeaking();
  }, []);

  if (outOfTurns) return <OutOfTurns onPremium={() => navigation.replace("Premium")} onBack={() => navigation.goBack()} />;
  if (summary) {
    return (
      <SummaryView
        summary={summary}
        onAgain={() => navigation.replace("Conversation", route.params)}
        onBack={() => navigation.goBack()}
      />
    );
  }
  if (!id || !status) {
    return (
      <View style={styles.center}>
        {error ? <ErrorRetry message={error} onRetry={() => setAttempt((n) => n + 1)} /> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }
  return (
    <Chat
      id={id}
      scenario={scenario}
      turns={turns}
      setTurns={setTurns}
      status={status}
      setStatus={setStatus}
      onSummary={setSummary}
      navigation={navigation}
      voice={voice}
    />
  );
}

function Chat({
  id,
  scenario,
  turns,
  setTurns,
  status,
  setStatus,
  onSummary,
  navigation,
  voice,
}: {
  voice: string | undefined;
  id: string;
  scenario: ConversationScenario | null;
  turns: ConversationTurn[];
  setTurns: (fn: (cur: ConversationTurn[]) => ConversationTurn[]) => void;
  status: ConversationStatus;
  setStatus: (s: ConversationStatus) => void;
  onSummary: (s: ConversationSummary) => void;
  navigation: Props["navigation"];
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { refreshMe } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [sendError, setSendError] = useState("");
  const [ending, setEnding] = useState(false);
  const [goalDone, setGoalDone] = useState(false);
  const [full, setFull] = useState(false);
  const [showGoal, setShowGoal] = useState(true);
  const scroll = useRef<ScrollView>(null);
  const outOfTurns = status.remaining <= 0;
  const locked = sending || ending || full || outOfTurns;
  const lastAi = [...turns].reverse().find((t) => !t.fromLearner) ?? null;
  const learnerTurns = turns.filter((t) => t.fromLearner && !t.id.startsWith("pending-")).length;

  async function end() {
    if (ending) return;
    stopSpeaking();
    setSendError("");
    setEnding(true);
    try {
      onSummary(await api.endConversation(id));
      refreshMe().catch(() => {});
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Chưa tổng kết được, bạn bấm lại nhé.");
    } finally {
      setEnding(false);
    }
  }

  /** Asks first while the talk can go on, so a stray tap doesn't end it. */
  function confirmEnd() {
    if (goalDone || full || outOfTurns) {
      void end();
      return;
    }
    Alert.alert("Kết thúc buổi đàm thoại?", "AI sẽ chấm điểm và chỉ ra những câu nên sửa.", [
      { text: "Nói tiếp", style: "cancel" },
      { text: "Kết thúc", onPress: () => void end() },
    ]);
  }

  async function send(raw: string) {
    const said = raw.trim().slice(0, MAX_TEXT);
    if (!said || locked) return;
    stopSpeaking();
    setSendError("");
    setSending(true);
    setText("");
    const pending: ConversationTurn = { id: `pending-${Date.now()}`, fromLearner: true, text: said, correction: null, hintVi: null, suggestions: [], audioUrl: null };
    setTurns((cur) => [...cur, pending]);
    try {
      const r = await api.sendConversationTurn(id, said);
      setTurns((cur) => [...cur.filter((t) => t.id !== pending.id), r.learner, r.reply]);
      setStatus(r.status);
      if (r.goalDone) setGoalDone(true);
      if (r.sessionFull) setFull(true);
      speakRecording(r.reply.audioUrl, r.reply.text, voice);
    } catch (e) {
      setTurns((cur) => cur.filter((t) => t.id !== pending.id));
      setText(said);
      if (e instanceof ApiError && e.status === 429) setStatus({ ...status, remaining: 0 });
      setSendError(e instanceof Error ? e.message : "Chưa gửi được, bạn thử lại nhé.");
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "web" ? undefined : "padding"} keyboardVerticalOffset={headerHeight}>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {scenario && showGoal ? (
          <Pressable style={styles.goal} onPress={() => setShowGoal(false)}>
            <Ionicons name="flag-outline" size={18} color={colors.accent} />
            <View style={styles.flex}>
              <Text style={styles.goalTitle}>Mục tiêu</Text>
              <Text style={styles.goalText}>{scenario.goalVi}</Text>
              {scenario.keyPhrases.length ? <Text style={styles.goalPhrases}>Gợi ý: {scenario.keyPhrases.join(" · ")}</Text> : null}
            </View>
            <Ionicons name="close" size={16} color={colors.muted} />
          </Pressable>
        ) : null}

        {turns.map((t) =>
          t.fromLearner ? (
            <LearnerBubble key={t.id} turn={t} pending={t.id.startsWith("pending-")} />
          ) : (
            <AiBubble key={t.id} turn={t} voice={voice} last={t.id === lastAi?.id && !locked} onPick={(s) => setText(s)} />
          )
        )}

        {sending ? (
          <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.typingText}>AI đang trả lời…</Text>
          </View>
        ) : null}

        {goalDone || full || outOfTurns ? (
          <View style={styles.banner}>
            <Ionicons name={goalDone ? "trophy" : "flag"} size={22} color={goalDone ? colors.gold : colors.accent} />
            <Text style={styles.bannerText}>
              {goalDone
                ? "Bạn đã hoàn thành mục tiêu! Nói thêm nếu muốn, hoặc xem tổng kết."
                : full
                  ? `Buổi này đã đủ ${status.maxTurnsPerSession} lượt.`
                  : status.premium
                    ? "Bạn đã dùng hết lượt nói hôm nay."
                    : `Hết ${status.dailyLimit} lượt nói miễn phí hôm nay. Premium có ${status.premiumDailyLimit} lượt mỗi ngày.`}
            </Text>
            <Pressable style={({ pressed }) => [styles.bannerButton, pressed && styles.pressed]} onPress={() => void end()} disabled={ending}>
              {ending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.bannerButtonText}>Xem tổng kết</Text>}
            </Pressable>
            {outOfTurns && !status.premium ? (
              <Pressable onPress={() => navigation.navigate("Premium")} hitSlop={8}>
                <Text style={styles.link}>Xem Premium</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
      <View style={styles.sessionBar}>
        {listening ? (
          <Text style={[styles.sessionCount, styles.listeningHint]}>Đang nghe… nói xong bấm ■ để gửi</Text>
        ) : (
          <Text style={styles.sessionCount}>
            Lượt {learnerTurns}/{status.maxTurnsPerSession}
            {status.remaining > 0 ? ` · còn ${status.remaining} lượt hôm nay` : ""}
          </Text>
        )}
        {learnerTurns > 0 && !listening ? (
          <Pressable
            onPress={confirmEnd}
            disabled={ending || sending}
            hitSlop={8}
            style={({ pressed }) => [styles.endChip, (ending || sending) && styles.dim, pressed && styles.pressed]}
          >
            <Ionicons name="flag-outline" size={14} color={colors.accent} />
            <Text style={styles.endChipText}>Kết thúc</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={locked ? "" : "Nói hoặc gõ câu trả lời bằng tiếng Anh…"}
          placeholderTextColor={colors.idle}
          editable={!locked}
          multiline
          maxLength={MAX_TEXT}
          autoCapitalize="sentences"
          submitBehavior="submit"
          returnKeyType="send"
          onSubmitEditing={() => void send(text)}
        />
        <MicButton
          continuous
          onText={(said) => void send(said)}
          onPartial={setText}
          onListening={setListening}
          size={44}
          disabled={locked}
        />
        <Pressable
          onPress={() => void send(text)}
          disabled={locked || !text.trim()}
          accessibilityLabel="Gửi"
          style={({ pressed }) => [styles.send, (locked || !text.trim()) && styles.dim, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-up" size={22} color={colors.white} />
        </Pressable>
      </View>
      {ending ? (
        <View style={styles.ending}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.endingTitle}>Đang tổng kết…</Text>
          <Text style={styles.endingText}>AI đang chấm điểm và chọn những câu bạn nên sửa.</Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function AiBubble({ turn, voice, last, onPick }: { turn: ConversationTurn; voice?: string; last: boolean; onPick: (text: string) => void }) {
  const [help, setHelp] = useState(false);
  const hasHelp = !!turn.hintVi || turn.suggestions.length > 0;
  return (
    <View style={[styles.bubble, styles.aiBubble]}>
      <Text style={styles.aiText}>{turn.text}</Text>
      <View style={styles.bubbleTools}>
        <Pressable onPress={() => speakRecording(turn.audioUrl, turn.text, voice)} hitSlop={8} accessibilityLabel="Nghe lại" style={styles.tool}>
          <Ionicons name="volume-high" size={16} color={colors.accent} />
          <Text style={styles.toolText}>Nghe lại</Text>
        </Pressable>
        {last && hasHelp ? (
          <Pressable onPress={() => setHelp(!help)} hitSlop={8} style={styles.tool}>
            <Ionicons name={help ? "bulb" : "bulb-outline"} size={16} color={colors.accent} />
            <Text style={styles.toolText}>{help ? "Ẩn gợi ý" : "Gợi ý trả lời"}</Text>
          </Pressable>
        ) : null}
      </View>
      {last && help ? (
        <View style={styles.help}>
          {turn.hintVi ? <Text style={styles.hint}>{turn.hintVi}</Text> : null}
          {turn.suggestions.map((s) => (
            <Pressable key={s} onPress={() => onPick(s)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <Text style={styles.suggestionText}>{s}</Text>
              <Ionicons name="arrow-down-circle-outline" size={16} color={colors.accent} />
            </Pressable>
          ))}
          <Text style={styles.helpNote}>Chạm câu mẫu để đưa vào ô trả lời, rồi đọc to hoặc gửi.</Text>
        </View>
      ) : null}
    </View>
  );
}

function LearnerBubble({ turn, pending }: { turn: ConversationTurn; pending: boolean }) {
  const c = turn.correction;
  return (
    <View style={styles.learnerWrap}>
      <View style={[styles.bubble, styles.learnerBubble, pending && styles.dim]}>
        <Text style={styles.learnerText}>{turn.text}</Text>
      </View>
      {c ? (
        <View style={styles.correction}>
          <View style={styles.correctionHead}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.correctionLabel}>Nói tự nhiên hơn</Text>
            <SpeakButton text={c.corrected} size="sm" />
          </View>
          <Text style={styles.corrected}>{c.corrected}</Text>
          {c.explainVi ? <Text style={styles.explain}>{c.explainVi}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function SummaryView({ summary, onAgain, onBack }: { summary: ConversationSummary; onAgain: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const good = summary.score >= 80;
  return (
    <ScrollView contentContainerStyle={[styles.summary, { paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreValue}>{summary.score}</Text>
        <Text style={styles.scoreLabel}>điểm</Text>
      </View>
      <Text style={styles.summaryTitle}>{good ? "Giỏi lắm!" : summary.learnerTurns ? "Xong buổi rồi!" : "Chưa có lượt nói"}</Text>
      <Text style={styles.summaryText}>{summary.feedbackVi}</Text>

      {summary.mistakes.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Câu nên sửa</Text>
          {summary.mistakes.map((m, i) => (
            <View key={i} style={styles.mistake}>
              <Text style={styles.original}>{m.original}</Text>
              <View style={styles.correctionHead}>
                <Text style={[styles.corrected, styles.flex]}>{m.corrected}</Text>
                <SpeakButton text={m.corrected} size="sm" />
              </View>
              {m.explainVi ? <Text style={styles.explain}>{m.explainVi}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {summary.phrases.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cụm từ nên học</Text>
          {summary.phrases.map((p, i) => (
            <View key={i} style={styles.phrase}>
              <View style={styles.flex}>
                <Text style={styles.phraseEn}>{p.en}</Text>
                <Text style={styles.phraseVi}>{p.vi}</Text>
              </View>
              <SpeakButton text={p.en} size="sm" />
            </View>
          ))}
        </View>
      ) : null}

      <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onAgain}>
        <Text style={styles.primaryText}>Luyện lại</Text>
      </Pressable>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.link}>Chọn tình huống khác</Text>
      </Pressable>
    </ScrollView>
  );
}

function OutOfTurns({ onPremium, onBack }: { onPremium: () => void; onBack: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="time-outline" size={48} color={colors.accent} />
      <Text style={styles.summaryTitle}>Hết lượt nói hôm nay</Text>
      <Text style={styles.summaryText}>Mai bạn quay lại nhé. Premium có nhiều lượt nói mỗi ngày hơn.</Text>
      <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onPremium}>
        <Text style={styles.primaryText}>Xem Premium</Text>
      </Pressable>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.link}>Quay lại</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bg },
  sessionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sessionCount: { fontSize: 12, fontWeight: "600", color: colors.muted },
  listeningHint: { color: colors.danger },
  endChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  endChipText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  ending: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: "rgba(231, 242, 236, 0.94)",
  },
  endingTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  endingText: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  messages: { padding: spacing.md, gap: 10, paddingBottom: spacing.lg, backgroundColor: colors.bg, flexGrow: 1 },
  goal: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.accentSoft },
  goalTitle: { fontSize: 12, fontWeight: "800", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  goalText: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  goalPhrases: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  bubble: { maxWidth: "86%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow.card, shadowOpacity: 0.05 },
  aiText: { fontSize: 16, lineHeight: 22, color: colors.ink },
  learnerWrap: { alignSelf: "flex-end", alignItems: "flex-end", maxWidth: "86%", gap: 6 },
  learnerBubble: { maxWidth: "100%", backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  learnerText: { fontSize: 16, lineHeight: 22, color: colors.white },
  bubbleTools: { flexDirection: "row", gap: 14, marginTop: 8 },
  tool: { flexDirection: "row", alignItems: "center", gap: 4 },
  toolText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  help: { marginTop: 8, gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.accentSoft },
  suggestionText: { flex: 1, fontSize: 14, color: colors.ink },
  helpNote: { fontSize: 11, color: colors.muted },
  correction: { alignSelf: "stretch", padding: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentSoft, gap: 2 },
  correctionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  correctionLabel: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.accent },
  corrected: { fontSize: 15, fontWeight: "700", color: colors.ink, lineHeight: 20 },
  explain: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  typing: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { fontSize: 13, color: colors.muted },
  banner: { alignItems: "center", gap: 8, padding: spacing.md, borderRadius: 18, backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.05 },
  bannerText: { fontSize: 14, color: colors.ink, textAlign: "center", lineHeight: 20 },
  bannerButton: { alignSelf: "stretch", alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: colors.accent },
  bannerButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.bg },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: colors.bg,
    fontSize: 16,
    color: colors.ink,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  summary: { padding: spacing.lg, gap: spacing.sm, alignItems: "stretch", backgroundColor: colors.bg, flexGrow: 1 },
  scoreCircle: {
    alignSelf: "center",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  scoreValue: { fontSize: 40, fontWeight: "800", color: colors.white },
  scoreLabel: { fontSize: 12, fontWeight: "700", color: colors.accentSoft, marginTop: -4 },
  summaryTitle: { fontSize: 22, fontWeight: "800", color: colors.ink, textAlign: "center" },
  summaryText: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
  section: { gap: 8, marginTop: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  mistake: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, gap: 4 },
  original: { fontSize: 14, color: colors.danger, textDecorationLine: "line-through" },
  phrase: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.surface },
  phraseEn: { fontSize: 15, fontWeight: "700", color: colors.ink },
  phraseVi: { fontSize: 13, color: colors.muted, marginTop: 2 },
  primary: { alignItems: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: colors.accent, marginTop: spacing.md, alignSelf: "stretch" },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  link: { color: colors.accent, fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 6 },
});
