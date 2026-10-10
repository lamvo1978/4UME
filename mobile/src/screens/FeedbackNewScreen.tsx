import Ionicons from "@expo/vector-icons/Ionicons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, FeedbackCategory } from "../api/client";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { PendingImages } from "../feedback/Attachments";
import { CATEGORIES, deviceInfo, MAX_BODY, MAX_IMAGES, pickImages } from "../feedback/meta";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

export function FeedbackNewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, "FeedbackNew">>();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedbackCategory>(params?.category ?? (params?.wordId ? "content" : "idea"));
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const info = deviceInfo();
  const hint = CATEGORIES.find((c) => c.value === category)?.hint;
  const canSend = body.trim().length > 0 && !sending;

  async function addImages() {
    try {
      const picked = await pickImages(MAX_IMAGES - images.length);
      if (picked) setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    } catch (e) {
      Alert.alert("Không mở được thư viện ảnh", e instanceof Error ? e.message : "Thử lại sau nhé.");
    }
  }

  async function send() {
    setSending(true);
    try {
      const ticket = await api.createFeedback({ category, body: body.trim(), wordId: params?.wordId, imageUris: images, ...info });
      navigation.replace("FeedbackThread", { id: ticket.id, justSent: true });
    } catch (e) {
      Alert.alert("Chưa gửi được", e instanceof Error ? e.message : "Thử lại sau nhé.");
      setSending(false);
    }
  }

  return (
    <KeyboardScreen contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      {params?.wordText ? (
        <View style={styles.wordBox}>
          <Ionicons name="flag-outline" size={18} color={colors.flameDeep} />
          <Text style={styles.wordText}>
            Báo lỗi cho từ <Text style={styles.wordStrong}>“{params.wordText}”</Text>
          </Text>
        </View>
      ) : null}

      <Text style={styles.label}>Loại góp ý</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.chip, category === c.value && styles.chipActive]}
            onPress={() => setCategory(c.value)}
          >
            <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Nội dung</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder={hint}
        placeholderTextColor={colors.muted}
        value={body}
        onChangeText={setBody}
        maxLength={MAX_BODY}
        textAlignVertical="top"
        autoFocus={!params?.wordText}
      />

      <View style={styles.attachRow}>
        <Pressable
          style={({ pressed }) => [styles.attach, images.length >= MAX_IMAGES && styles.disabled, pressed && styles.pressed]}
          onPress={addImages}
          disabled={images.length >= MAX_IMAGES}
        >
          <Ionicons name="image-outline" size={18} color={colors.accent} />
          <Text style={styles.attachText}>
            Thêm ảnh ({images.length}/{MAX_IMAGES})
          </Text>
        </Pressable>
        <Text style={styles.count}>
          {body.length}/{MAX_BODY}
        </Text>
      </View>
      <PendingImages uris={images} onRemove={(uri) => setImages((prev) => prev.filter((u) => u !== uri))} />

      <Text style={styles.note}>
        Kèm theo: phiên bản {info.appVersion} · {info.device} ({info.platform}) để 4UME dễ tìm lỗi hơn.
      </Text>

      <Pressable style={({ pressed }) => [styles.send, !canSend && styles.disabled, pressed && styles.pressed]} onPress={send} disabled={!canSend}>
        {sending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
        <Text style={styles.sendText}>{sending ? "Đang gửi…" : "Gửi góp ý"}</Text>
      </Pressable>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.sm },
  wordBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.flameSoft,
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  wordText: { flex: 1, color: colors.ink, fontSize: 15 },
  wordStrong: { fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.white },
  input: {
    minHeight: 160,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  attachRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  attach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: colors.accentSoft,
  },
  attachText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  count: { color: colors.muted, fontSize: 12 },
  note: { marginTop: spacing.md, color: colors.muted, fontSize: 12, lineHeight: 17 },
  send: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 15,
  },
  sendText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.6 },
});
