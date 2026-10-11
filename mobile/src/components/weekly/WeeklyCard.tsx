import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WeekSummary } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { highlights, weekRange } from "../../weekly/weekly";

/** Monday's look back at last week on Home, one row like the goal card; tapping opens the full summary. */
export function WeeklyCard({ week, onPress, onClose }: { week: WeekSummary; onPress: () => void; onClose: () => void }) {
  const parts = highlights(week);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="calendar" size={22} color={colors.gold} />
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <Text style={styles.title}>Tuần qua: học {week.studyDays}/7 ngày</Text>
          <Text style={styles.range}>{weekRange(week)}</Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {parts.length ? parts.join(" · ") : "Xem tổng kết tuần"}
        </Text>
      </View>
      <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Đóng tổng kết tuần">
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FDF1C7",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  range: { fontSize: 12, color: colors.muted },
  sub: { marginTop: 4, fontSize: 13, color: colors.muted },
});
