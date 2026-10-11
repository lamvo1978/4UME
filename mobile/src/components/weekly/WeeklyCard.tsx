import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WeekSummary } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { weekRange } from "../../weekly/weekly";

/** Monday's look back at last week on Home, one row like the other Home cards; tapping opens the full summary. */
export function WeeklyCard({ week, onPress }: { week: WeekSummary; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="calendar" size={22} color={colors.gold} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Tuần qua: học {week.studyDays}/7 ngày</Text>
        <Text style={styles.sub}>Tổng kết {weekRange(week)}</Text>
      </View>
      <Ionicons name="arrow-forward" size={22} color={colors.accent} />
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
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 2, fontSize: 13, color: colors.muted },
});
