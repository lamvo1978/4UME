import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ListeningDetail } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { WordSheet } from "../components/listening/WordSheet";
import { Segmented } from "../components/Segmented";
import { Engine, useAudioEngine, useSpeechEngine } from "../listening/engines";
import { formatClock, KIND_META, SCRIPT_MODES, ScriptMode, SPEEDS, tokenize } from "../listening/meta";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, shadow, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Listening">;

const SPEAKER_COLORS = [colors.accent, colors.flameDeep, colors.ice, "#8A5A00"];

type Settings = {
  rate: number;
  repeat: boolean;
  mode: ScriptMode;
};

type SessionProps = {
  lesson: ListeningDetail;
  settings: Settings;
  onSettings: (s: Partial<Settings>) => void;
  onComplete: () => void;
};

export function ListeningPlayerScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { refreshMe } = useAuth();
  const [lesson, setLesson] = useState<ListeningDetail | null>(null);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings>({ rate: 1, repeat: false, mode: "both" });

  useEffect(() => {
    api
      .listeningLesson(slug)
      .then((l) => {
        setLesson(l);
        setLiked(l.progress.liked);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Không tải được bài nghe"));
  }, [slug]);

  const toggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    api.saveListeningProgress(slug, { liked: next }).catch(() => setLiked(!next));
  }, [liked, slug]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        lesson ? (
          <Pressable onPress={toggleLike} hitSlop={10}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? colors.flameDeep : colors.ink} />
          </Pressable>
        ) : null,
    });
  }, [navigation, lesson, liked, toggleLike]);

  const onComplete = useCallback(() => {
    api
      .saveListeningProgress(slug, { completed: true })
      .then(() => refreshMe())
      .catch(() => {});
  }, [slug, refreshMe]);

  const onSettings = useCallback((s: Partial<Settings>) => setSettings((cur) => ({ ...cur, ...s })), []);

  if (!lesson) {
    return <View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.accent} />}</View>;
  }

  const props = { lesson, settings, onSettings, onComplete };
  return lesson.audioUrl ? <AudioSession {...props} url={lesson.audioUrl} /> : <SpeechSession {...props} />;
}

function useEngineOptions({ lesson, settings, onComplete }: SessionProps, onPause: (ms: number) => void) {
  const speakers = useMemo(() => lesson.speakers.map((s) => s.key), [lesson.speakers]);
  return {
    lines: lesson.lines,
    speakers,
    rate: settings.rate,
    repeat: settings.repeat,
    title: lesson.titleEn,
    artist: `4UME · ${lesson.titleVi}`,
    initialMs: lesson.progress.completed ? 0 : lesson.progress.positionMs,
    onComplete,
    onPause,
  };
}

function AudioSession(props: SessionProps & { url: string }) {
  const { slug } = props.lesson;
  const savePosition = useCallback(
    (ms: number) => void api.saveListeningProgress(slug, { positionMs: Math.round(ms) }).catch(() => {}),
    [slug]
  );
  const engine = useAudioEngine(props.url, useEngineOptions(props, savePosition));

  const last = useRef({ position: 0, duration: 0 });
  last.current = { position: engine.positionMs, duration: engine.durationMs };
  useEffect(
    () => () => {
      const { position, duration } = last.current;
      if (position > 0) savePosition(duration && position >= duration * 0.9 ? 0 : position);
    },
    [savePosition]
  );

  return <PlayerView {...props} engine={engine} />;
}

function SpeechSession(props: SessionProps) {
  const engine = useSpeechEngine(useEngineOptions(props, () => {}));
  return <PlayerView {...props} engine={engine} />;
}

function PlayerView({ lesson, settings, onSettings, engine }: SessionProps & { engine: Engine }) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const lineY = useRef<number[]>([]);
  const lastDrag = useRef(0);
  const [word, setWord] = useState<string | null>(null);
  const { lines, speakers } = lesson;
  const { active, playing } = engine;
  const kind = KIND_META[lesson.kind];
  const names = useMemo(() => new Map(speakers.map((s, i) => [s.key, { name: s.name, color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }])), [speakers]);

  // Follow the voice, but not while the learner is scrolling around themselves.
  useEffect(() => {
    if (active < 0 || settings.mode === "hidden" || Date.now() - lastDrag.current < 4000) return;
    const y = lineY.current[active];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  }, [active, settings.mode]);

  function lookUp(w: string) {
    engine.pause();
    setWord(w);
  }

  function previous() {
    const start = lines[active]?.startMs;
    const intoLine = engine.kind === "audio" && start != null && engine.positionMs - start > 1500;
    engine.playLine(intoLine ? active : Math.max(active - 1, 0));
  }

  const progress = engine.durationMs ? Math.min(1, engine.positionMs / engine.durationMs) : 0;
  const nextRate = SPEEDS[(SPEEDS.indexOf(settings.rate as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => (lastDrag.current = Date.now())}
      >
        <View style={styles.intro}>
          <View style={styles.tags}>
            <Tag icon={kind.icon} text={kind.label} />
            <Tag text={lesson.level} />
            {lesson.topic ? <Tag text={lesson.topic} /> : null}
          </View>
          <Text style={styles.titleEn}>{lesson.titleEn}</Text>
          {lesson.summaryVi ? <Text style={styles.summary}>{lesson.summaryVi}</Text> : null}
          {engine.kind === "speech" ? (
            <Text style={styles.note}>Bài này chưa có bản thu, đang đọc bằng giọng của máy.</Text>
          ) : null}
          <Segmented items={SCRIPT_MODES} value={settings.mode} onChange={(mode) => onSettings({ mode })} />
        </View>

        {settings.mode === "hidden" ? (
          <View style={styles.hidden}>
            <Ionicons name="headset-outline" size={36} color={colors.accent} />
            <Text style={styles.hiddenTitle}>Chỉ nghe thôi</Text>
            <Text style={styles.hiddenText}>
              {active >= 0 ? `Câu ${active + 1}/${lines.length}` : `${lines.length} câu`} · Bật lại script bất cứ lúc nào.
            </Text>
          </View>
        ) : (
          lines.map((line, i) => {
            const speaker = names.get(line.speaker);
            const isActive = i === active;
            return (
              <Pressable
                key={i}
                onLayout={(e) => (lineY.current[i] = e.nativeEvent.layout.y)}
                onPress={() => engine.playLine(i)}
                style={[styles.line, isActive && styles.lineActive]}
              >
                {speakers.length > 1 && speaker ? (
                  <Text style={[styles.speaker, { color: speaker.color }]}>{speaker.name}</Text>
                ) : null}
                <Text style={[styles.en, playing && !isActive && styles.dim]}>
                  {tokenize(line.en).map((t, k) =>
                    t.word ? (
                      <Text key={k} onPress={() => engine.playLine(i)} onLongPress={() => lookUp(t.word!)}>
                        {t.text}
                      </Text>
                    ) : (
                      t.text
                    )
                  )}
                </Text>
                {settings.mode === "both" && line.vi ? <Text style={styles.vi}>{line.vi}</Text> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>
            {engine.kind === "audio" ? formatClock(engine.positionMs) : `Câu ${Math.max(active, 0) + 1}`}
          </Text>
          <Text style={styles.time}>{engine.kind === "audio" ? formatClock(engine.durationMs) : `${lines.length} câu`}</Text>
        </View>
        <View style={styles.buttons}>
          <Pressable onPress={() => onSettings({ repeat: !settings.repeat })} hitSlop={8} style={styles.side}>
            <Ionicons name="repeat" size={24} color={settings.repeat ? colors.accent : colors.idle} />
            <Text style={[styles.sideText, settings.repeat && styles.sideTextOn]}>Lặp câu</Text>
          </Pressable>
          <Pressable onPress={previous} hitSlop={8}>
            <Ionicons name="play-skip-back" size={28} color={colors.ink} />
          </Pressable>
          <Pressable onPress={engine.toggle} style={({ pressed }) => [styles.play, pressed && styles.pressed]}>
            {engine.loading && !playing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name={playing ? "pause" : "play"} size={32} color={colors.white} style={!playing && styles.playIcon} />
            )}
          </Pressable>
          <Pressable onPress={() => engine.playLine(Math.min(active + 1, lines.length - 1))} hitSlop={8}>
            <Ionicons name="play-skip-forward" size={28} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => onSettings({ rate: nextRate })} hitSlop={8} style={styles.side}>
            <Text style={styles.speed}>{settings.rate}×</Text>
            <Text style={styles.sideText}>Tốc độ</Text>
          </Pressable>
        </View>
      </View>

      <WordSheet word={word} onClose={() => setWord(null)} />
    </View>
  );
}

function Tag({ text, icon }: { text: string; icon?: (typeof KIND_META)["story"]["icon"] }) {
  return (
    <View style={styles.tag}>
      {icon ? <Ionicons name={icon} size={13} color={colors.accent} /> : null}
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.danger, textAlign: "center" },
  content: { padding: spacing.lg, gap: 6, paddingBottom: spacing.xl },
  intro: { gap: spacing.sm, marginBottom: spacing.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  tagText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  titleEn: { fontSize: 24, fontWeight: "800", color: colors.ink, fontFamily: fonts.display },
  summary: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  note: { fontSize: 13, color: colors.flameDeep, lineHeight: 18 },
  line: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, gap: 3 },
  lineActive: { backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.06 },
  speaker: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  en: { fontSize: 18, lineHeight: 26, color: colors.ink },
  dim: { color: colors.muted },
  vi: { fontSize: 14, lineHeight: 20, color: colors.muted },
  hidden: { alignItems: "center", gap: spacing.xs, padding: spacing.xl, borderRadius: 20, backgroundColor: colors.surface },
  hiddenTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  hiddenText: { fontSize: 14, color: colors.muted, textAlign: "center" },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...shadow.card,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.bgAlt, overflow: "hidden" },
  trackFill: { height: 4, backgroundColor: colors.accent },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  time: { fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs },
  side: { width: 56, alignItems: "center", gap: 2 },
  sideText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  sideTextOn: { color: colors.accent },
  speed: { fontSize: 18, fontWeight: "800", color: colors.ink },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  playIcon: { marginLeft: 4 },
  pressed: { opacity: 0.8 },
});
