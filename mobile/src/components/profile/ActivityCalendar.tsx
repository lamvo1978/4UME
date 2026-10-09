import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StudyDay } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { addDays, parseDay, toDayKey, WEEKDAY_SHORT, weekdayIndex } from "../../utils/dates";

const WEEKS = 5;

/** Grammar items take longer than a flashcard, so they weigh more. */
function score(d: StudyDay) {
  return d.newWords + d.reviews + d.grammarItems * 3;
}

function shade(d: StudyDay | undefined) {
  if (!d) return colors.bgAlt;
  if (d.frozen) return colors.ice;
  const s = score(d);
  if (s >= 30) return colors.flameDeep;
  if (s >= 10) return colors.flame;
  return "#FFC48A";
}

export function ActivityCalendar({ today, days, totalDays }: { today: string; days: StudyDay[]; totalDays: number }) {
  const weeks = useMemo(() => {
    const byKey = new Map(days.map((d) => [d.date, d]));
    const todayDate = parseDay(today);
    const firstMonday = addDays(todayDate, -weekdayIndex(todayDate) - (WEEKS - 1) * 7);
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(firstMonday, w * 7 + i);
        const key = toDayKey(date);
        return { key, future: date > todayDate, isToday: key === today, day: byKey.get(key) };
      })
    );
  }, [today, days]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>5 tuần gần đây</Text>
        <Text style={styles.total}>Tổng {totalDays} ngày học</Text>
      </View>
      <View style={styles.row}>
        {WEEKDAY_SHORT.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((c) => (
            <View
              key={c.key}
              style={[
                styles.cell,
                { backgroundColor: c.future ? "transparent" : shade(c.day) },
                c.isToday && styles.today,
              ]}
            />
          ))}
        </View>
      ))}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Ít</Text>
        {[colors.bgAlt, "#FFC48A", colors.flame, colors.flameDeep].map((c) => (
          <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendText}>Nhiều</Text>
        <View style={[styles.legendCell, styles.legendGap, { backgroundColor: colors.ice }]} />
        <Text style={styles.legendText}>Đóng băng</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: 6, ...shadow.card },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  total: { fontSize: 13, fontWeight: "600", color: colors.muted },
  row: { flexDirection: "row", gap: 6 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.muted },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 8 },
  today: { borderWidth: 2, borderColor: colors.ink },
  legend: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  legendText: { fontSize: 11, color: colors.muted, marginHorizontal: 2 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
  legendGap: { marginLeft: spacing.sm },
});
