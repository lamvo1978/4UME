import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Memory } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";

/** Review levels grouped into what the learner understands: index ranges into Memory.levels. */
const BANDS = [
  { label: "Mới nhớ", from: 0, to: 2, color: "#9FD3C4" },
  { label: "Đang chắc", from: 2, to: 4, color: "#4FA892" },
  { label: "Nhớ lâu", from: 4, to: 5, color: colors.accent },
  { label: "Đã thuộc", from: 5, to: 6, color: "#0A4339" },
];

export function MemoryCard({
  icon,
  title,
  unit,
  learningLabel,
  memory,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  unit: string;
  learningLabel: string;
  memory: Memory;
}) {
  const bands = BANDS.map((b) => ({ ...b, count: memory.levels.slice(b.from, b.to).reduce((a, n) => a + n, 0) }));
  const total = bands.reduce((a, b) => a + b.count, 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={20} color={colors.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.total}>
          {total} {unit} đã nhớ
        </Text>
      </View>

      <View style={styles.stack}>
        {total === 0 ? <View style={[styles.segment, { flex: 1, backgroundColor: colors.bgAlt }]} /> : null}
        {bands
          .filter((b) => b.count > 0)
          .map((b) => (
            <View key={b.label} style={[styles.segment, { flex: b.count, backgroundColor: b.color }]} />
          ))}
      </View>
      <View style={styles.legend}>
        {bands.map((b) => (
          <View key={b.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: b.color }]} />
            <Text style={styles.legendText}>
              {b.label} <Text style={styles.legendCount}>{b.count}</Text>
            </Text>
          </View>
        ))}
      </View>
      {memory.learning > 0 ? (
        <Text style={styles.learning}>
          {learningLabel}: {memory.learning} {unit}
        </Text>
      ) : null}

      <View style={styles.levels}>
        {memory.byLevel.map((l) => (
          <View key={l.level} style={styles.levelRow}>
            <Text style={styles.levelBadge}>{l.level}</Text>
            <View style={styles.levelBar}>
              <View style={[styles.levelFill, { width: `${l.total ? (l.done / l.total) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.levelText}>
              {l.done}/{l.total}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, ...shadow.card },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  total: { fontSize: 13, fontWeight: "700", color: colors.accent },
  stack: { flexDirection: "row", height: 14, borderRadius: 99, overflow: "hidden", marginTop: spacing.md, gap: 2 },
  segment: { height: 14 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: 4, marginTop: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.muted },
  legendCount: { fontWeight: "800", color: colors.ink },
  learning: { marginTop: spacing.sm, fontSize: 13, color: colors.muted },
  levels: { marginTop: spacing.md, gap: 8 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  levelBadge: {
    width: 34,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  levelBar: { flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.bgAlt, overflow: "hidden" },
  levelFill: { height: 6, borderRadius: 99, backgroundColor: colors.accent },
  levelText: { width: 72, textAlign: "right", fontSize: 12, fontWeight: "600", color: colors.muted },
});
