import Ionicons from "@expo/vector-icons/Ionicons";
import { useHeaderHeight } from "@react-navigation/elements";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, FeedbackMessage, FeedbackTicket } from "../api/client";
import { MessageImages, PendingImages } from "../feedback/Attachments";
import { categoryLabel, CLOSED_NOTE, MAX_BODY, MAX_IMAGES, pickImages, shortTime, STATUS } from "../feedback/meta";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

export function FeedbackThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, "FeedbackThread">>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scroll = useRef<ScrollView>(null);
  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<"send" | "resolve" | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .feedbackTicket(params.id)
        .then((t) => {
          setTicket(t);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Không tải được góp ý."));
    }, [params.id])
  );

  async function addImages() {
    try {
      const picked = await pickImages(MAX_IMAGES - images.length);
      if (picked) setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    } catch (e) {
      Alert.alert("Không mở được thư viện ảnh", e instanceof Error ? e.message : "Thử lại sau nhé.");
    }
  }

  async function send() {
    setBusy("send");
    try {
      setTicket(await api.replyFeedback(params.id, body.trim(), images));
      setBody("");
      setImages([]);
    } catch (e) {
      Alert.alert("Chưa gửi được", e instanceof Error ? e.message : "Thử lại sau nhé.");
    } finally {
      setBusy(null);
    }
  }

  function resolve() {
    Alert.alert("Đã giải quyết?", "Góp ý sẽ được đóng lại. Nếu còn vấn đề, bạn có thể gửi góp ý mới bất cứ lúc nào.", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Đã giải quyết",
        onPress: async () => {
          setBusy("resolve");
          try {
            setTicket(await api.resolveFeedback(params.id));
          } catch (e) {
            Alert.alert("Chưa đóng được", e instanceof Error ? e.message : "Thử lại sau nhé.");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const closed = ticket.status === "closed";
  const canSend = body.trim().length > 0 && busy === null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.head}>
          <Text style={styles.category}>{categoryLabel(ticket.category)}</Text>
          <View style={[styles.pill, { backgroundColor: STATUS[ticket.status].bg }]}>
            <Text style={[styles.pillText, { color: STATUS[ticket.status].fg }]}>{STATUS[ticket.status].label}</Text>
          </View>
        </View>
        {ticket.word ? (
          <Text style={styles.word}>
            Từ “{ticket.word.text}” · {ticket.word.meaningVi}
          </Text>
        ) : null}

        {ticket.messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}

        {params.justSent && ticket.messages.length === 1 ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            <Text style={styles.noticeText}>Đã gửi! 4UME sẽ trả lời tại đây, chuông ở Trang chủ báo chấm đỏ khi có trả lời.</Text>
          </View>
        ) : null}

        {closed ? (
          <View style={styles.closedBox}>
            <Text style={styles.closedText}>{CLOSED_NOTE[ticket.closedBy ?? "admin"]}</Text>
            <Pressable
              style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
              onPress={() => navigation.replace("FeedbackNew")}
            >
              <Text style={styles.newText}>Gửi góp ý mới</Text>
            </Pressable>
          </View>
        ) : ticket.status === "answered" ? (
          <Pressable
            style={({ pressed }) => [styles.resolve, pressed && styles.pressed]}
            onPress={resolve}
            disabled={busy !== null}
          >
            {busy === "resolve" ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Ionicons name="checkmark-done" size={18} color={colors.accent} />
            )}
            <Text style={styles.resolveText}>Đã giải quyết</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {!closed ? (
        <View style={[styles.composer, { paddingBottom: spacing.sm + insets.bottom }]}>
          <PendingImages uris={images} onRemove={(uri) => setImages((prev) => prev.filter((u) => u !== uri))} />
          <View style={styles.composerRow}>
            <Pressable
              onPress={addImages}
              disabled={images.length >= MAX_IMAGES}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, images.length >= MAX_IMAGES && styles.disabled, pressed && styles.pressed]}
              accessibilityLabel="Thêm ảnh"
            >
              <Ionicons name="image-outline" size={22} color={colors.accent} />
            </Pressable>
            <TextInput
              style={styles.input}
              multiline
              placeholder={ticket.status === "answered" ? "Trả lời 4UME…" : "Bổ sung thêm…"}
              placeholderTextColor={colors.muted}
              value={body}
              onChangeText={setBody}
              maxLength={MAX_BODY}
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              style={({ pressed }) => [styles.sendBtn, !canSend && styles.disabled, pressed && styles.pressed]}
              accessibilityLabel="Gửi"
            >
              {busy === "send" ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Bubble({ message: m }: { message: FeedbackMessage }) {
  return (
    <View style={[styles.bubbleWrap, m.fromAdmin ? styles.left : styles.right]}>
      {m.fromAdmin ? <Text style={styles.author}>4UME{m.authorName ? ` · ${m.authorName}` : ""}</Text> : null}
      <View style={[styles.bubble, m.fromAdmin ? styles.bubbleAdmin : styles.bubbleMe]}>
        {m.body ? <Text style={[styles.body, !m.fromAdmin && styles.bodyMe]}>{m.body}</Text> : null}
        <MessageImages urls={m.images} />
      </View>
      <Text style={styles.time}>{shortTime(m.createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.danger, textAlign: "center" },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  category: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
  word: { color: colors.muted, fontSize: 13 },
  bubbleWrap: { maxWidth: "86%", gap: 3 },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  author: { fontSize: 12, fontWeight: "700", color: colors.accent, marginLeft: 4 },
  bubble: { borderRadius: 18, padding: 12 },
  bubbleAdmin: { backgroundColor: colors.surface, borderTopLeftRadius: 6, ...shadow.card },
  bubbleMe: { backgroundColor: colors.accent, borderTopRightRadius: 6 },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink },
  bodyMe: { color: colors.white },
  time: { fontSize: 11, color: colors.muted, marginHorizontal: 4 },
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.accentSoft, borderRadius: 14, padding: spacing.sm },
  noticeText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18 },
  closedBox: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  closedText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  newBtn: { backgroundColor: colors.accent, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
  newText: { color: colors.white, fontWeight: "700" },
  resolve: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  resolveText: { color: colors.accent, fontWeight: "700" },
  composer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    backgroundColor: colors.bg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.ink,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
