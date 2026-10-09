import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Streak } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { FREEZE_EVERY, previousMilestone, streakStatus } from "../streak/streakCopy";
import { WeekStrip } from "../streak/WeekStrip";

function explainFreeze(max: number) {
  Alert.alert(
    "Đóng băng chuỗi",
    `Cứ mỗi ${FREEZE_EVERY} ngày học liên tiếp, bạn nhận 1 lượt đóng băng (giữ tối đa ${max}).\n\nNếu lỡ quên học một ngày, app tự dùng 1 lượt để chuỗi không bị mất.`
  );
}

export function StreakCard({ streak }: { streak: Streak }) {
  const active = streak.studiedToday;
  const from = previousMilestone(streak.current);
  const to = streak.nextMilestone;
  const ratio = to ? (streak.current - from) / (to - from) : 1;
  const goalMet = streak.todayNewWords >= streak.dailyGoal;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.flame, active && styles.flameActive]}>
          <Ionicons name="flame" size={44} color={active ? colors.white : colors.idle} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.count, !active && styles.countIdle]}>{streak.current}</Text>
          <Text style={styles.countLabel}>ngày học liên tiếp</Text>
        </View>
        <View style={styles.side}>
          <View style={styles.best}>
            <Ionicons name="trophy" size={14} color={colors.gold} />
            <Text style={styles.bestText}>Kỷ lục {streak.best}</Text>
          </View>
          <Pressable style={styles.freezes} onPress={() => explainFreeze(streak.maxFreezes)} hitSlop={6}>
            {Array.from({ length: streak.maxFreezes }, (_, i) => (
              <View key={i} style={[styles.freezeDot, i < streak.freezes && styles.freezeDotOn]}>
                <Ionicons name="snow" size={13} color={i < streak.freezes ? colors.white : colors.idle} />
              </View>
            ))}
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.status}>{streakStatus(streak.current, active)}</Text>

      <View style={styles.week}>
        <WeekStrip today={streak.today} days={streak.days} />
      </View>

      {to ? (
        <View style={styles.milestone}>
          <View style={styles.milestoneTop}>
            <Text style={styles.milestoneText}>Mốc tiếp theo: {to} ngày</Text>
            <Text style={styles.milestoneLeft}>còn {to - streak.current} ngày</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.max(ratio, 0.04) * 100}%` }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.today}>
        <TodayStat
          icon={goalMet ? "trophy" : "flag"}
          value={`${streak.todayNewWords}/${streak.dailyGoal}`}
          label="Từ mới"
          highlight={goalMet}
        />
        <TodayStat icon="repeat" value={String(streak.todayReviews)} label="Lượt ôn" />
        <TodayStat icon="document-text" value={String(streak.todayGrammar)} label="Ngữ pháp" />
      </View>
    </View>
  );
}

function TodayStat({
  icon,
  value,
  label,
  highlight,
}: {
  icon: "trophy" | "flag" | "repeat" | "document-text";
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.stat, highlight && styles.statMet]}>
      <Ionicons name={icon} size={16} color={highlight ? colors.gold : colors.flameDeep} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.md, ...shadow.card },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  flame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  flameActive: { backgroundColor: colors.flame },
  count: { fontSize: 40, fontWeight: "800", color: colors.flameDeep, lineHeight: 44 },
  countIdle: { color: colors.ink },
  countLabel: { fontSize: 14, fontWeight: "600", color: colors.muted },
  side: { alignItems: "flex-end", gap: 8 },
  best: { flexDirection: "row", alignItems: "center", gap: 4 },
  bestText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  freezes: { flexDirection: "row", alignItems: "center", gap: 4 },
  freezeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.idle,
    alignItems: "center",
    justifyContent: "center",
  },
  freezeDotOn: { backgroundColor: colors.ice, borderColor: colors.ice, borderStyle: "solid" },
  status: { marginTop: spacing.md, fontSize: 14, color: colors.ink, fontWeight: "600" },
  week: { marginTop: spacing.md },
  milestone: { marginTop: spacing.md },
  milestoneTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  milestoneText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  milestoneLeft: { fontSize: 13, fontWeight: "600", color: colors.flameDeep },
  bar: { height: 8, borderRadius: 99, backgroundColor: colors.flameSoft, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 99, backgroundColor: colors.flame },
  today: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.flameSoft,
    gap: 2,
  },
  statMet: { backgroundColor: "#FFF3C4" },
  statValue: { fontSize: 17, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
});
