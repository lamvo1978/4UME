import Ionicons from "@expo/vector-icons/Ionicons";
import { RouteProp, useRoute } from "@react-navigation/native";
import { ComponentProps, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, WeekDay, Weekly } from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { WEEKDAY_SHORT } from "../utils/dates";
import { comparison, dayActivity, weekRange } from "../weekly/weekly";

/** This week plus two months back. */
const WEEKS = 9;
const BAR_HEIGHT = 96;

export function WeeklyScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Weekly">>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Weekly | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api
      .weekly(WEEKS)
      .then((d) => {
        setData(d);
        const i = d.weeks.findIndex((w) => w.start === route.params?.start);
        setIndex(i < 0 ? 0 : i);
      })
      .catch(() => setFailed(true));
  }, [route.params?.start]);

  if (!data) {
    return (
      <View style={[styles.root, styles.center]}>
        {failed ? (
          <Text style={styles.muted}>Không tải được tổng kết. Bạn thử lại sau nhé.</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const week = data.weeks[index];
  const previous = data.weeks[index + 1];
  const label = index === 0 ? "Tuần này" : index === 1 ? "Tuần trước" : `${index} tuần trước`;
  const elapsed = week.inProgress ? week.days.filter((d) => d.date <= data.today).length : 7;
  const compare = comparison(week, previous);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.nav}>
        <NavButton icon="chevron-back" disabled={index >= data.weeks.length - 1} onPress={() => setIndex(index + 1)} />
        <View style={styles.navText}>
          <Text style={styles.navLabel}>{label}</Text>
          <Text style={styles.navRange}>{weekRange(week)}</Text>
        </View>
        <NavButton icon="chevron-forward" disabled={index === 0} onPress={() => setIndex(index - 1)} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroValue}>
          {week.studyDays}
          <Text style={styles.heroOf}>/{elapsed}</Text>
        </Text>
        <Text style={styles.heroLabel}>{week.inProgress ? "ngày đã học tuần này" : "ngày học trong tuần"}</Text>
        {week.streakAtEnd > 0 ? (
          <Text style={styles.heroStreak}>
            {week.inProgress ? "Chuỗi hiện tại" : "Chuỗi cuối tuần"}: {week.streakAtEnd} ngày
          </Text>
        ) : null}
        {compare ? (
          <View style={styles.compare}>
            <Ionicons name="trending-up" size={14} color={colors.white} />
            <Text style={styles.compareText}>{compare}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Từng ngày</Text>
        <DayBars days={week.days} today={data.today} />
      </View>

      <View style={styles.grid}>
        <Stat icon="sparkles-outline" value={week.newWords} label="từ mới" />
        <Stat icon="repeat-outline" value={week.reviews} label="lượt ôn từ" />
        <Stat icon="create-outline" value={week.grammarItems} label="lượt ngữ pháp" />
        <Stat icon="headset-outline" value={week.listens} label="bài nghe hết" />
        <Stat icon="pencil-outline" value={week.dictationLines} label="câu chép chính tả" />
        <Stat icon="mic-outline" value={week.goodPronunciations} label="từ đọc chuẩn" />
      </View>

      {!data.listensCountTowardStreak ? (
        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          <Text style={styles.infoText}>
            Nghe hết bài hiện chưa tính vào chuỗi ngày học, nên ngày chỉ nghe sẽ không có cột trong biểu đồ. Chép chính tả
            vẫn được tính.
          </Text>
        </View>
      ) : null}

      {week.studyDays === 0 ? (
        <Text style={styles.empty}>
          {week.inProgress
            ? "Tuần này chưa học ngày nào. Một bài ôn 5 phút là đủ để bắt đầu lại."
            : "Tuần này không học ngày nào. Không sao, quan trọng là quay lại."}
        </Text>
      ) : null}
      <Text style={styles.note}>Đọc chuẩn: từ được chấm phát âm từ 80 điểm trở lên.</Text>
    </ScrollView>
  );
}

function DayBars({ days, today }: { days: WeekDay[]; today: string }) {
  const max = Math.max(1, ...days.map(dayActivity));
  return (
    <View style={styles.bars}>
      {days.map((d, i) => {
        const future = d.date > today;
        const value = dayActivity(d);
        return (
          <View key={d.date} style={styles.barCol}>
            <View style={styles.barTrack}>
              {d.frozen ? (
                <Ionicons name="snow" size={18} color={colors.ice} />
              ) : d.studied ? (
                <View style={[styles.bar, { height: Math.max(8, (value / max) * BAR_HEIGHT) }]} />
              ) : (
                <View style={[styles.barEmpty, future && styles.barFuture]} />
              )}
            </View>
            <Text style={[styles.barDay, d.date === today && styles.barToday]}>{WEEKDAY_SHORT[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Stat({ icon, value, label }: { icon: ComponentProps<typeof Ionicons>["name"]; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={value ? colors.accent : colors.idle} />
      <Text style={[styles.statValue, !value && styles.statZero]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavButton({ icon, disabled, onPress }: { icon: "chevron-back" | "chevron-forward"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.navBtn, disabled && styles.navBtnOff, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={disabled ? colors.idle : colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  muted: { color: colors.muted, textAlign: "center" },
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnOff: { backgroundColor: colors.bgAlt },
  navText: { alignItems: "center" },
  navLabel: { fontSize: 17, fontWeight: "800", color: colors.ink },
  navRange: { fontSize: 13, color: colors.muted, marginTop: 2 },
  hero: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: 4,
    ...shadow.card,
  },
  heroValue: { fontSize: 52, fontWeight: "800", color: colors.white, lineHeight: 60 },
  heroOf: { fontSize: 26, fontWeight: "700", color: colors.white, opacity: 0.7 },
  heroLabel: { fontSize: 15, fontWeight: "600", color: colors.white, opacity: 0.9 },
  heroStreak: { fontSize: 13, fontWeight: "700", color: colors.white, opacity: 0.85 },
  info: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.bgAlt,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.muted },
  compare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  compareText: { fontSize: 13, fontWeight: "700", color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.md, ...shadow.card },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  bars: { flexDirection: "row", justifyContent: "space-between" },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { height: BAR_HEIGHT, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: 22, borderRadius: 8, backgroundColor: colors.flame },
  barEmpty: { width: 22, height: 8, borderRadius: 4, backgroundColor: colors.bgAlt },
  barFuture: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, backgroundColor: "transparent" },
  barDay: { fontSize: 12, fontWeight: "600", color: colors.muted },
  barToday: { color: colors.accent, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    width: "31.5%",
    flexGrow: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.ink },
  statZero: { color: colors.idle },
  statLabel: { fontSize: 12, color: colors.muted, textAlign: "center" },
  empty: { fontSize: 14, lineHeight: 20, color: colors.ink, textAlign: "center" },
  note: { fontSize: 12, color: colors.muted, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
