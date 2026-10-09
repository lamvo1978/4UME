import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, mediaUrl, Word } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Screen } from "../components/Screen";
import { SpeakButton, speakAuto, stopSpeaking } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { posLabel } from "../vocabulary/deckMeta";

type Props = NativeStackScreenProps<RootStackParamList, "Flashcard">;

/** Hard (1) is used as "Học sau" — postponed to the next batch. */
const STATUS = { New: 0, Later: 1, Known: 2 } as const;
const DEFAULT_SESSION_SIZE = 10;

/** Up to half postponed words, the rest new; backfill from either side when one runs short. */
function buildSession(pending: Word[], size: number): Word[] {
  const later = pending.filter((w) => w.status === STATUS.Later);
  const fresh = pending.filter((w) => w.status !== STATUS.Later);
  const pickedLater = later.slice(0, Math.ceil(size / 2));
  const pickedFresh = fresh.slice(0, size - pickedLater.length);
  const backfill = later.slice(pickedLater.length, pickedLater.length + size - pickedLater.length - pickedFresh.length);
  const laterAll = [...pickedLater, ...backfill];

  const mixed: Word[] = [];
  for (let i = 0; i < Math.max(laterAll.length, pickedFresh.length); i++) {
    if (pickedFresh[i]) mixed.push(pickedFresh[i]);
    if (laterAll[i]) mixed.push(laterAll[i]);
  }
  return mixed;
}

export function FlashcardScreen({ route, navigation }: Props) {
  const { deckId } = route.params;
  const { me, refreshMe } = useAuth();
  const sessionSize = me?.settings.dailyGoal ?? DEFAULT_SESSION_SIZE;
  const [session, setSession] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [deckTotal, setDeckTotal] = useState(0);
  const [deckKnownBefore, setDeckKnownBefore] = useState(0);
  const [result, setResult] = useState({ known: 0, later: 0 });
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const flip = useRef(new Animated.Value(0)).current;

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const words = await api.deckWords(deckId);
      const pending = words.filter((w) => w.status !== STATUS.Known);
      setSession(buildSession(pending, sessionSize));
      setDeckTotal(words.length);
      setDeckKnownBefore(words.length - pending.length);
      setIndex(0);
      setResult({ known: 0, later: 0 });
      setKnownIds([]);
      flip.setValue(0);
      setFlipped(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được từ");
    } finally {
      setLoading(false);
    }
    // sessionSize is read once per batch; changing the goal mid-batch shouldn't reload the deck.
  }, [deckId, flip]);

  useEffect(() => {
    loadSession();
    return () => {
      stopSpeaking();
    };
  }, [loadSession]);

  const current = session[index];

  useEffect(() => {
    if (current) speakAuto(current.word);
  }, [current?.id]);

  function toggleFlip() {
    Animated.spring(flip, { toValue: flipped ? 0 : 1, useNativeDriver: true, friction: 8, tension: 60 }).start();
    setFlipped((f) => !f);
  }

  async function rate(status: number) {
    if (!current) return;
    stopSpeaking();
    flip.setValue(0);
    setFlipped(false);
    setResult((r) => (status === STATUS.Known ? { ...r, known: r.known + 1 } : { ...r, later: r.later + 1 }));
    setIndex((i) => i + 1);
    try {
      await api.updateProgress(current.id, status);
      if (status === STATUS.Known) setKnownIds((ids) => [...ids, current.id]);
      await refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được tiến trình");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error && session.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (session.length === 0) {
    return (
      <Screen edges={["bottom", "left", "right"]} style={[styles.root, styles.doneRoot]}>
        <View style={styles.doneIcon}>
          <Ionicons name="trophy-outline" size={40} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>Bạn đã nhớ hết bộ này</Text>
        <Text style={styles.doneSub}>{deckTotal} từ đều đã được đánh dấu "Đã nhớ".</Text>
        <View style={styles.doneActions}>
          <ActionButton label="Xong" icon="checkmark" variant="primary" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  if (!current) {
    const deckKnown = deckKnownBefore + result.known;
    const remaining = deckTotal - deckKnown;
    return (
      <Screen edges={["bottom", "left", "right"]} style={[styles.root, styles.doneRoot]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark-done" size={44} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>Xong lượt {session.length} từ</Text>
        <View style={styles.summaryRow}>
          <SummaryStat value={result.known} label="Đã nhớ" />
          <SummaryStat value={result.later} label="Học sau" />
        </View>
        <View style={styles.deckProgress}>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${deckTotal ? (deckKnown / deckTotal) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.doneSub}>
            Cả bộ: đã nhớ {deckKnown}/{deckTotal} từ
          </Text>
        </View>
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        {knownIds.length > 0 ? (
          <View style={styles.doneActions}>
            <ActionButton
              label={`Luyện ngay ${knownIds.length} từ vừa nhớ`}
              icon="flash-outline"
              variant="outline"
              onPress={() =>
                navigation.navigate("Review", { mode: "practice", wordIds: knownIds, title: "Luyện từ vừa nhớ" })
              }
            />
          </View>
        ) : null}
        <View style={[styles.doneActions, knownIds.length > 0 && styles.doneActionsTight]}>
          <ActionButton label="Xong" icon="checkmark" variant="outline" onPress={() => navigation.goBack()} />
          {remaining > 0 ? (
            <ActionButton
              label={`Học tiếp ${Math.min(sessionSize, remaining)} từ`}
              icon="arrow-forward"
              variant="primary"
              onPress={loadSession}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  const imageUrl = current.imageUrl && !brokenImages.has(current.id) ? mediaUrl(current.imageUrl) : null;
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <Screen edges={["bottom", "left", "right"]} style={styles.root}>
      <View style={styles.progressRow}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${(index / session.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {index + 1}/{session.length}
        </Text>
      </View>
      <Text style={styles.remaining}>
        {current.status === STATUS.Later ? "Từ bạn để học sau" : "Từ mới"} · cả bộ đã nhớ {deckKnownBefore + result.known}/
        {deckTotal}
      </Text>

      <Pressable style={styles.cardArea} onPress={toggleFlip}>
        <Animated.View
          style={[styles.card, { transform: [{ perspective: 1000 }, { rotateY: frontRotate }] }]}
          pointerEvents={flipped ? "none" : "auto"}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setBrokenImages((s) => new Set(s).add(current.id))}
            />
          ) : null}
          <Text style={styles.word} adjustsFontSizeToFit numberOfLines={1}>
            {current.word}
          </Text>
          <View style={styles.ipaRow}>
            {current.ipa ? <Text style={styles.ipa}>{current.ipa}</Text> : null}
            <SpeakButton text={current.word} />
          </View>
          {current.forms ? <Text style={styles.forms}>{current.forms}</Text> : null}
          <View style={styles.tags}>
            <Text style={styles.tag}>{posLabel(current.pos)}</Text>
            <Text style={styles.tag}>{current.level}</Text>
          </View>
          <View style={styles.hintRow}>
            <Ionicons name="sync-outline" size={14} color={colors.muted} />
            <Text style={styles.hint}>Chạm để xem nghĩa</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.card, styles.cardBack, { transform: [{ perspective: 1000 }, { rotateY: backRotate }] }]}
          pointerEvents={flipped ? "auto" : "none"}
        >
          <View style={styles.backWordRow}>
            <Text style={styles.backWord}>{current.word}</Text>
            <SpeakButton text={current.word} size="sm" />
          </View>
          <Text style={styles.meaning}>{current.meaningVi}</Text>
          {current.example ? (
            <View style={styles.exampleBox}>
              <View style={styles.exampleRow}>
                <Text style={styles.example}>{current.example}</Text>
                <SpeakButton text={current.example} size="sm" />
              </View>
              {current.exampleVi ? <Text style={styles.exampleVi}>{current.exampleVi}</Text> : null}
            </View>
          ) : null}
        </Animated.View>
      </Pressable>

      {error ? <Text style={styles.inlineError}>{error}</Text> : null}

      <View style={styles.actions}>
        <ActionButton label="Học sau" icon="time-outline" variant="outline" onPress={() => rate(STATUS.Later)} />
        <ActionButton label="Đã nhớ" icon="checkmark" variant="primary" onPress={() => rate(STATUS.Known)} />
      </View>
    </Screen>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  variant,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  variant: "outline" | "primary";
  onPress: () => void;
}) {
  const color = variant === "primary" ? colors.white : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, styles[variant], pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barBg: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.accentSoft, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 99, backgroundColor: colors.accent },
  progressText: { fontWeight: "700", color: colors.accent, minWidth: 48, textAlign: "right" },
  remaining: { marginTop: 4, marginBottom: spacing.md, color: colors.muted, fontSize: 13 },
  cardArea: { flex: 1 },
  card: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backfaceVisibility: "hidden",
    ...shadow.card,
  },
  cardBack: { justifyContent: "flex-start", paddingTop: spacing.xl },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 20,
    marginBottom: spacing.lg,
    backgroundColor: colors.bgAlt,
  },
  word: { fontSize: 44, fontWeight: "700", color: colors.ink },
  ipaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  ipa: { fontSize: 18, color: colors.muted },
  forms: { marginTop: 10, fontSize: 16, fontWeight: "700", color: colors.flameDeep },
  tags: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  tag: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  hintRow: { position: "absolute", bottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { color: colors.muted, fontSize: 13 },
  backWordRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backWord: { fontSize: 20, fontWeight: "700", color: colors.muted },
  meaning: {
    marginTop: spacing.md,
    fontSize: 30,
    fontWeight: "700",
    color: colors.accent,
    textAlign: "center",
  },
  exampleBox: {
    marginTop: spacing.lg,
    alignSelf: "stretch",
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: spacing.md,
    gap: 6,
  },
  exampleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  example: { flex: 1, fontSize: 17, lineHeight: 24, color: colors.ink },
  exampleVi: { fontSize: 15, lineHeight: 21, color: colors.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  btn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { fontWeight: "700", fontSize: 16 },
  outline: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.surface },
  primary: { backgroundColor: colors.accent },
  pressed: { opacity: 0.7 },
  inlineError: { color: colors.danger, marginTop: spacing.sm, textAlign: "center" },
  error: { color: colors.danger },
  doneRoot: { alignItems: "center", justifyContent: "center" },
  doneIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { marginTop: spacing.lg, fontSize: 26, fontWeight: "700", color: colors.ink },
  doneSub: { marginTop: spacing.xs, color: colors.muted, fontSize: 15 },
  doneActions: { flexDirection: "row", gap: 10, marginTop: spacing.xl, alignSelf: "stretch" },
  doneActionsTight: { marginTop: 10 },
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
  summaryValue: { fontSize: 32, fontWeight: "700", color: colors.accent },
  summaryLabel: { marginTop: 2, color: colors.muted, fontWeight: "600" },
  deckProgress: { alignSelf: "stretch", marginTop: spacing.lg, gap: spacing.xs },
});
