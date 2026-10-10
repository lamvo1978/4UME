import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PronunciationStatus } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { formatDayMonthYear } from "../../utils/dates";

/** One-line plan summary on the profile; the details live on the Premium screen. */
export function PlanRow({ status, onPress }: { status: PronunciationStatus; onPress: () => void }) {
  const premium = status.premium && !!status.premiumUntil;
  return (
    <Pressable style={({ pressed }) => [styles.row, premium && styles.rowPremium, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.icon, premium && styles.iconPremium]}>
        <Ionicons name={premium ? "sparkles" : "leaf-outline"} size={18} color={premium ? colors.white : colors.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{premium ? "Premium" : "Gói miễn phí"}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {premium ? `Đến ${formatDayMonthYear(status.premiumUntil!)}` : `${status.freeDailyLimit} lượt chấm phát âm chi tiết mỗi ngày`}
        </Text>
      </View>
      <Text style={styles.cta}>{premium ? "Chi tiết" : "Xem Premium"}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  rowPremium: { borderWidth: 1.5, borderColor: colors.gold },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPremium: { backgroundColor: colors.gold },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  subtitle: { marginTop: 1, fontSize: 12, color: colors.muted },
  cta: { fontSize: 13, fontWeight: "700", color: colors.accent },
  pressed: { opacity: 0.6 },
});
