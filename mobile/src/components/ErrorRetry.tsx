import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OFFLINE_MESSAGE } from "../api/client";
import { colors, spacing } from "../theme";

/** Shown instead of a screen's content when it could not load. */
export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const offline = message === OFFLINE_MESSAGE;
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name={offline ? "cloud-offline-outline" : "alert-circle-outline"} size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>{offline ? "Chưa có kết nối mạng" : "Chưa tải được dữ liệu"}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onRetry}>
        <Text style={styles.buttonText}>Thử lại</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", padding: spacing.lg, gap: spacing.sm },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center" },
  message: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  button: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  pressed: { opacity: 0.85 },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
