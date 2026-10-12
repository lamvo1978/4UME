import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { ensureReminderPermission, markReminderOffered } from "../../notifications/reminders";
import { colors, shadow, spacing } from "../../theme";

/** Offered once, right after a streak celebration, so new learners actually get reminders. */
export function ReminderPrompt({ onClose }: { onClose: () => void }) {
  const { me, updateSettings } = useAuth();
  const [busy, setBusy] = useState(false);
  const time = me?.settings.reminderTime ?? "20:00";

  useEffect(() => {
    markReminderOffered().catch(() => undefined);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      if (await ensureReminderPermission()) await updateSettings({ reminderEnabled: true });
    } catch {
      // Still closes; reminders can be turned on later in Settings.
    } finally {
      onClose();
    }
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="notifications" size={44} color={colors.flame} />
          </View>
          <Text style={styles.title}>Giữ lửa mỗi ngày nhé?</Text>
          <Text style={styles.sub}>
            4UME sẽ nhắc bạn học lúc {time} mỗi ngày. Bạn đổi giờ hoặc tắt bất cứ lúc nào trong Hồ sơ › Cài đặt.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={enable}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Bật nhắc học</Text>}
          </Pressable>
          <Pressable style={({ pressed }) => [styles.later, pressed && styles.pressed]} onPress={onClose} disabled={busy}>
            <Text style={styles.laterText}>Để sau</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,46,40,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    ...shadow.card,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.flameSoft,
    marginBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 8, fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21 },
  button: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: colors.flame,
  },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "800" },
  later: { alignSelf: "stretch", marginTop: spacing.sm, paddingVertical: 12, alignItems: "center" },
  laterText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.8 },
});
