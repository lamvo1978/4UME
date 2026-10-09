import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StudyDay } from "../../api/client";
import { colors } from "../../theme";
import { addDays, parseDay, toDayKey, WEEKDAY_SHORT, weekdayIndex } from "../../utils/dates";

type DayState = "active" | "frozen" | "today" | "missed" | "future";

/** Monday–Sunday of the current week: flame for studied days, snowflake for frozen ones. */
export function WeekStrip({ today, days, size = 36 }: { today: string; days: StudyDay[]; size?: number }) {
  const cells = useMemo(() => {
    const byKey = new Map(days.map((d) => [d.date, d]));
    const todayDate = parseDay(today);
    const monday = addDays(todayDate, -weekdayIndex(todayDate));
    return WEEKDAY_SHORT.map((label, i) => {
      const date = addDays(monday, i);
      const key = toDayKey(date);
      const day = byKey.get(key);
      let state: DayState;
      if (day?.frozen) state = "frozen";
      else if (day) state = "active";
      else if (key === today) state = "today";
      else state = date > todayDate ? "future" : "missed";
      return { label, key, state, isToday: key === today };
    });
  }, [today, days]);

  return (
    <View style={styles.row}>
      {cells.map((c) => (
        <View key={c.key} style={styles.cell}>
          <Text style={[styles.label, c.isToday && styles.labelToday]}>{c.label}</Text>
          <View
            style={[
              styles.dot,
              { width: size, height: size, borderRadius: size / 2 },
              c.state === "active" && styles.dotActive,
              c.state === "frozen" && styles.dotFrozen,
              c.state === "today" && styles.dotToday,
              c.state === "missed" && styles.dotMissed,
            ]}
          >
            {c.state === "active" ? <Ionicons name="flame" size={size * 0.55} color={colors.white} /> : null}
            {c.state === "frozen" ? <Ionicons name="snow" size={size * 0.5} color={colors.white} /> : null}
            {c.state === "today" ? <Ionicons name="flame-outline" size={size * 0.5} color={colors.flame} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  cell: { alignItems: "center", gap: 6 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted },
  labelToday: { color: colors.flameDeep },
  dot: { alignItems: "center", justifyContent: "center", backgroundColor: colors.bgAlt },
  dotActive: { backgroundColor: colors.flame },
  dotFrozen: { backgroundColor: colors.ice },
  dotToday: { backgroundColor: colors.flameSoft, borderWidth: 2, borderColor: colors.flame, borderStyle: "dashed" },
  dotMissed: { backgroundColor: colors.bgAlt, opacity: 0.6 },
});
