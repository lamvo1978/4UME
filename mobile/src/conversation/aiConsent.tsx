import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

const PRIVACY_URL = "https://4ume.io.vn/privacy/";

/** "talk" = Đàm thoại với AI, "writing" = Luyện viết với AI; each asks once since they send different things. */
export type AiConsentKind = "talk" | "writing";

const keyOf = (userId: string, kind: AiConsentKind) => (kind === "talk" ? `fourume.aiConsent.${userId}` : `fourume.aiConsent.${kind}.${userId}`);

/** Apple 5.1.2(i): what the learner says goes to a third-party AI only after they agree, once per account on this phone. */
export async function hasAiConsent(userId: string, kind: AiConsentKind = "talk") {
  return (await AsyncStorage.getItem(keyOf(userId, kind))) === "yes";
}

export function saveAiConsent(userId: string, kind: AiConsentKind = "talk") {
  return AsyncStorage.setItem(keyOf(userId, kind), "yes");
}

const TEXTS: Record<AiConsentKind, { title: string; body: string; first: { icon: keyof typeof Ionicons.glyphMap; text: string }; use: string }> = {
  talk: {
    title: "Trò chuyện với AI",
    body: "Để AI trả lời và sửa câu cho bạn, những câu bạn nói hoặc gõ trong phần này (dạng chữ) sẽ được gửi tới dịch vụ AI bên ngoài của đối tác 4UME.",
    first: { icon: "mic-off-outline", text: "Không gửi bản ghi âm giọng nói của bạn." },
    use: "Chỉ dùng để tạo câu trả lời, sửa lỗi và tổng kết buổi học.",
  },
  writing: {
    title: "AI chấm bài viết",
    body: "Để AI chấm điểm và sửa lỗi, đoạn văn bạn viết trong phần này sẽ được gửi tới dịch vụ AI bên ngoài của đối tác 4UME. 4UME lưu bài để bạn xem lại, bạn xoá được bất cứ lúc nào.",
    first: { icon: "create-outline", text: "Chỉ gửi đoạn văn bạn bấm chấm, không gửi gì khác." },
    use: "Chỉ dùng để chấm điểm, sửa lỗi và gợi ý cách viết hay hơn.",
  },
};

/** Names no provider on purpose: the privacy policy lists them, so switching AI needs no app update. */
export function AiConsentModal({
  visible,
  onAgree,
  onDecline,
  kind = "talk",
}: {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
  kind?: AiConsentKind;
}) {
  const t = TEXTS[kind];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="sparkles" size={26} color={colors.white} />
          </View>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.body}>{t.body}</Text>
          <View style={styles.points}>
            <Point icon={t.first.icon} text={t.first.text} />
            <Point icon="person-remove-outline" text="Không gửi email hay tên của bạn." />
            <Point icon="shield-checkmark-outline" text={t.use} />
          </View>
          <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
            <Text style={styles.link}>Xem chính sách quyền riêng tư</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onAgree}>
            <Text style={styles.primaryText}>Đồng ý và bắt đầu</Text>
          </Pressable>
          <Pressable onPress={onDecline} hitSlop={8}>
            <Text style={styles.secondary}>Để sau</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Point({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26, 46, 40, 0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 420, alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: 24, backgroundColor: colors.surface },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.ink, textAlign: "center" },
  points: { alignSelf: "stretch", gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.bg },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
  pointText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.ink },
  link: { fontSize: 13, fontWeight: "700", color: colors.accent, textDecorationLine: "underline" },
  primary: { alignSelf: "stretch", alignItems: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: colors.accent, marginTop: 4 },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.8 },
  secondary: { fontSize: 14, fontWeight: "700", color: colors.muted, paddingVertical: 4 },
});
