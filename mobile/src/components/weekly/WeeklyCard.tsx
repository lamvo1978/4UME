import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WeekSummary } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { comparison, highlights, weekRange } from "../../weekly/weekly";

/** Monday's look back at last week on Home; tapping opens the full summary. */
export function WeeklyCard({
  week,
  previous,
  onPress,
  onClose,
}: {
  week: WeekSummary;
  previous: WeekSummary | undefined;
  onPress: () => void;
  onClose: () => void;
}) {
  const parts = highlights(week);
  const compare = comparison(week, previous);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="calendar" size={18} color={colors.white} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title}>Tổng kết tuần qua</Text>
          <Text style={styles.range}>{weekRange(week)}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Đóng tổng kết tuần">
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={styles.big}>
        Bạn học {week.studyDays}/7 ngày{week.streakAtEnd >= 2 ? ` · chuỗi ${week.streakAtEnd} ngày` : ""}
      </Text>
      {parts.length ? <Text style={styles.parts}>{parts.join(" · ")}</Text> : null}
      {compare ? (
        <View style={styles.compare}>
          <Ionicons name="trending-up" size={14} color={colors.accent} />
          <Text style={styles.compareText}>{compare}</Text>
        </View>
      ) : null}
      <Text style={styles.more}>Xem chi tiết ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: 6,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadow.card,
  },
  pressed: { opacity: 0.6 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  range: { fontSize: 12, color: colors.muted },
  big: { marginTop: 4, fontSize: 20, fontWeight: "800", color: colors.ink },
  parts: { fontSize: 14, lineHeight: 20, color: colors.ink },
  compare: { flexDirection: "row", alignItems: "center", gap: 6 },
  compareText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  more: { marginTop: 2, fontSize: 13, fontWeight: "700", color: colors.accent },
});
