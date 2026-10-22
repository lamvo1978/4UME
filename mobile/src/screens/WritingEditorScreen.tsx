import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError, WritingStatus } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AiConsentModal, hasAiConsent, saveAiConsent } from "../conversation/aiConsent";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { countWords, MAX_CHARS, MIN_WORDS, wordRange } from "../writing/meta";

type Props = NativeStackScreenProps<RootStackParamList, "WritingEditor">;

const draftKey = (userId: string, p: Props["route"]["params"]) =>
  `fourume.writingDraft.${userId}.${p.parentId ? `rewrite-${p.parentId}` : p.promptId ?? `free-${p.level}`}`;

export function WritingEditorScreen({ navigation, route }: Props) {
  const params = route.params;
  const { me } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(params.text ?? "");
  const [topic, setTopic] = useState(params.topic ?? "");
  const [status, setStatus] = useState<WritingStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ message: string; premium: boolean } | null>(null);
  const loaded = useRef(false);
  const input = useRef<TextInput>(null);

  const [defaultMin, defaultMax] = wordRange(params.level);
  const min = params.minWords || defaultMin;
  const max = params.maxWords || defaultMax;
  const words = countWords(text);
  const free = params.promptId === null;
  const key = me ? draftKey(me.userId, params) : null;

  useEffect(() => {
    api.writingStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!key || params.text) {
      loaded.current = true;
      return;
    }
    AsyncStorage.getItem(key)
      .then((saved) => {
        if (!saved) return;
        const d = JSON.parse(saved) as { text?: string; topic?: string };
        if (d.text) setText(d.text);
        if (d.topic) setTopic(d.topic);
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
      });
  }, [key, params.text]);

  useEffect(() => {
    if (!key || !loaded.current) return;
    const timer = setTimeout(() => {
      void (text.trim() ? AsyncStorage.setItem(key, JSON.stringify({ text, topic })) : AsyncStorage.removeItem(key)).catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [key, text, topic]);

  const addPhrase = (phrase: string) => {
    const starter = phrase.replace(/…|\.\.\.$/g, "").trim();
    setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")} ${starter} ` : `${starter} `));
    input.current?.focus();
  };

  async function submit() {
    if (!me || sending) return;
    if (!(await hasAiConsent(me.userId, "writing"))) {
      setAsking(true);
      return;
    }
    await send();
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const r = await api.submitWriting({
        promptId: params.promptId,
        level: params.level,
        topic: free ? topic.trim() || undefined : undefined,
        text,
        parentId: params.parentId ?? null,
      });
      if (key) await AsyncStorage.removeItem(key).catch(() => undefined);
      setStatus(r.status);
      navigation.replace("WritingResult", { id: r.submission.id, submission: r.submission });
    } catch (e) {
      const limit = e instanceof ApiError && e.code === "limit";
      if (e instanceof ApiError && e.status === 429 && status) setStatus({ ...status, remaining: limit ? 0 : status.remaining, dayFull: !limit });
      setError({ message: e instanceof Error ? e.message : "Chưa chấm được, bạn thử lại nhé.", premium: limit && !status?.premium });
    } finally {
      setSending(false);
    }
  }

  const agree = async () => {
    setAsking(false);
    if (me) await saveAiConsent(me.userId, "writing").catch(() => {});
    await send();
  };

  const tooShort = words < MIN_WORDS;
  const countColor = words < min ? colors.muted : words > max ? colors.flameDeep : colors.accent;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "web" ? undefined : "padding"} keyboardVerticalOffset={headerHeight}>
      <AiConsentModal kind="writing" visible={asking} onAgree={() => void agree()} onDecline={() => setAsking(false)} />
      <Modal visible={sending} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.busy}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.busyTitle}>AI đang chấm bài…</Text>
            <Text style={styles.busyText}>Thường mất 10–40 giây, bạn chờ chút nhé.</Text>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {params.promptEn ? (
          <View style={styles.prompt}>
            <Text style={styles.promptLabel}>Đề bài · {params.level}</Text>
            <Text style={styles.promptText}>{params.promptEn}</Text>
            {params.guideVi ? <Text style={styles.guide}>{params.guideVi}</Text> : null}
            {params.keyPhrases?.length ? (
              <View style={styles.phrases}>
                {params.keyPhrases.map((p) => (
                  <Pressable key={p} onPress={() => addPhrase(p)} style={({ pressed }) => [styles.phrase, pressed && styles.pressed]}>
                    <Text style={styles.phraseText}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.prompt}>
            <Text style={styles.promptLabel}>Viết tự do · {params.level}</Text>
            <TextInput
              style={styles.topic}
              value={topic}
              onChangeText={setTopic}
              placeholder="Chủ đề (không bắt buộc), vd: my best friend"
              placeholderTextColor={colors.muted}
              maxLength={120}
            />
          </View>
        )}

        <TextInput
          ref={input}
          style={styles.editor}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          placeholder="Viết đoạn văn bằng tiếng Anh ở đây…"
          placeholderTextColor={colors.muted}
          maxLength={MAX_CHARS}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="sentences"
        />
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: countColor }]}>
            {words} từ · gợi ý {min}–{max} từ
          </Text>
          {text.length > MAX_CHARS - 100 ? (
            <Text style={styles.chars}>
              {text.length}/{MAX_CHARS} ký tự
            </Text>
          ) : null}
        </View>
        <Text style={styles.hint}>Máy đã tắt tự sửa chính tả để AI thấy đúng lỗi của bạn. Nháp được lưu trên máy.</Text>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.premium ? (
              <Pressable onPress={() => navigation.navigate("Premium")} hitSlop={8}>
                <Text style={styles.errorLink}>Xem Premium</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        {status ? (
          <Text style={styles.quota}>
            {status.remaining > 0 && !status.dayFull ? `Còn ${status.remaining}/${status.dailyLimit} bài chấm hôm nay` : "Hôm nay đã hết lượt chấm"}
          </Text>
        ) : null}
        <Pressable
          disabled={tooShort || sending}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.submit, (tooShort || sending) && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="sparkles" size={18} color={colors.white} />
          <Text style={styles.submitText}>{tooShort ? `Viết ít nhất ${MIN_WORDS} từ` : "Chấm bài"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  prompt: { gap: 6, padding: 14, borderRadius: 18, backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.05 },
  promptLabel: { fontSize: 11, fontWeight: "800", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  promptText: { fontSize: 15, lineHeight: 22, color: colors.ink, fontWeight: "600" },
  guide: { fontSize: 13, lineHeight: 18, color: colors.muted },
  phrases: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  phrase: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.accentSoft },
  phraseText: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  topic: { fontSize: 15, color: colors.ink, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  editor: {
    minHeight: 240,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  countRow: { flexDirection: "row", justifyContent: "space-between" },
  count: { fontSize: 13, fontWeight: "700" },
  chars: { fontSize: 12, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  error: { gap: 6, padding: 12, borderRadius: 14, backgroundColor: colors.dangerSoft },
  errorText: { fontSize: 13, lineHeight: 18, color: colors.danger },
  errorLink: { fontSize: 13, fontWeight: "800", color: colors.accent },
  footer: { gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.bg },
  quota: { fontSize: 12, color: colors.muted, textAlign: "center" },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16, backgroundColor: colors.accent },
  submitText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  backdrop: { flex: 1, backgroundColor: "rgba(26, 46, 40, 0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  busy: { alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface, minWidth: 260 },
  busyTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  busyText: { fontSize: 13, color: colors.muted, textAlign: "center" },
});
