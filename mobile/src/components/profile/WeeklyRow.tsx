import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StudyDay } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { addDays, parseDay, toDayKey, weekdayIndex } from "../../utils/dates";

/** Entry to the weekly summary, with this week's study days so far from the profile's streak data. */
export function WeeklyRow({ today, days, onPress }: { today: string; days: StudyDay[]; onPress: () => void }) {
  const todayDate = parseDay(today);
  const monday = toDayKey(addDays(todayDate, -weekdayIndex(todayDate)));
  const studied = days.filter((d) => d.date >= monday && d.date <= today && !d.frozen).length;
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="stats-chart" size={17} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Tổng kết tuần</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          Tuần này đã học {studied}/{weekdayIndex(todayDate) + 1} ngày · xem các tuần trước
        </Text>
      </View>
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
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  subtitle: { marginTop: 1, fontSize: 12, color: colors.muted },
  pressed: { opacity: 0.6 },
});
