import Ionicons from "@expo/vector-icons/Ionicons";
import { CompositeNavigationProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ComponentProps, useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Me, ReviewSummary } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { StreakChip } from "../components/streak/StreakChip";
import { streakStatus } from "../components/streak/streakCopy";
import { Screen } from "../components/Screen";
import { MainTabParamList, RootStackParamList } from "../navigation/types";
import { colors, fonts, shadow, spacing } from "../theme";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeScreen() {
  const { me, user, refreshMe } = useAuth();
  const navigation = useNavigation<Nav>();
  const name = me?.displayName ?? user?.displayName;
  const grammarDone = me?.grammarLessonsCompleted ?? 0;
  const grammarTotal = me?.grammarLessonsTotal ?? 0;
  const [review, setReview] = useState<ReviewSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.reviewSummary().then(setReview).catch(() => setReview(null));
      refreshMe().catch(() => undefined);
    }, [refreshMe])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require("../../assets/logo-emblem.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>4UME</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => navigation.navigate("WordSearch")}
              hitSlop={8}
              style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
              accessibilityLabel="Tìm từ"
            >
              <Ionicons name="search" size={20} color={colors.accent} />
            </Pressable>
            <StreakChip
              streak={me?.streak ?? 0}
              studiedToday={me?.studiedToday ?? false}
              onPress={() => navigation.navigate("Profile")}
            />
            <Pressable onPress={() => navigation.navigate("Profile")} hitSlop={8}>
              <Avatar name={name} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.hello}>Xin chào, {name}</Text>
        <Text style={styles.progress}>
          Đã nhớ {me?.knownWords ?? 0} từ · Ngữ pháp {grammarDone}/{grammarTotal} bài
        </Text>

        {me && !me.settings.vocabLevel ? (
          <Pressable
            style={({ pressed }) => [styles.placement, pressed && styles.pressed]}
            onPress={() => navigation.navigate("Placement")}
          >
            <View style={styles.placementIcon}>
              <Ionicons name="school-outline" size={24} color={colors.white} />
            </View>
            <View style={styles.entryText}>
              <Text style={styles.placementTitle}>Kiểm tra trình độ từ vựng</Text>
              <Text style={styles.placementSub}>2–3 phút để bỏ qua những từ bạn đã biết</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color={colors.accent} />
          </Pressable>
        ) : null}

        {me ? <GoalCard me={me} onPress={() => navigation.navigate("Study", { tab: "vocab" })} /> : null}

        {review && review.inReview > 0 ? (
          <ReviewBanner
            review={review}
            onPress={() =>
              navigation.navigate(
                "Review",
                review.dueCount > 0 ? { mode: "due" } : { mode: "practice", title: "Luyện thêm" }
              )
            }
          />
        ) : null}

        <View style={styles.card}>
          <Entry
            icon="book-outline"
            title="Từ vựng"
            subtitle="Theo chủ đề · A1–B2"
            onPress={() => navigation.navigate("Study", { tab: "vocab" })}
          />
          <View style={styles.divider} />
          <Entry
            icon="create-outline"
            title="Ngữ pháp"
            subtitle={grammarTotal ? `${grammarTotal} bài · A1–B1` : "Bài học ngữ pháp"}
            onPress={() => navigation.navigate("Study", { tab: "grammar" })}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function GoalCard({ me, onPress }: { me: Me; onPress: () => void }) {
  const goal = me.settings.dailyGoal;
  const done = Math.min(me.todayNewWords, goal);
  const met = me.todayNewWords >= goal;
  return (
    <Pressable style={({ pressed }) => [styles.goal, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.goalIcon, met && styles.goalIconMet]}>
        <Ionicons name={met ? "trophy" : "flag"} size={22} color={met ? colors.white : colors.flame} />
      </View>
      <View style={styles.entryText}>
        <View style={styles.goalTop}>
          <Text style={styles.goalTitle}>{met ? "Đã đạt mục tiêu!" : "Mục tiêu hôm nay"}</Text>
          <Text style={[styles.goalCount, met && styles.goalCountMet]}>
            {me.todayNewWords}/{goal} từ mới
          </Text>
        </View>
        <View style={styles.goalBar}>
          <View style={[styles.goalFill, met && styles.goalFillMet, { width: `${(done / goal) * 100}%` }]} />
        </View>
        <Text style={styles.goalSub}>{streakStatus(me.streak, me.studiedToday)}</Text>
      </View>
    </Pressable>
  );
}

function ReviewBanner({ review, onPress }: { review: ReviewSummary; onPress: () => void }) {
  const due = review.dueCount > 0;
  const next = review.nextDueAt ? new Date(review.nextDueAt) : null;
  return (
    <Pressable
      style={({ pressed }) => [styles.review, !due && styles.reviewIdle, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.reviewIcon, !due && styles.reviewIconIdle]}>
        <Ionicons name={due ? "repeat" : "flash-outline"} size={24} color={due ? colors.accent : colors.white} />
      </View>
      <View style={styles.entryText}>
        <Text style={[styles.reviewTitle, !due && styles.reviewTitleIdle]}>
          {due ? `Ôn tập hôm nay: ${review.dueCount} từ` : "Đã ôn xong · Luyện thêm?"}
        </Text>
        <Text style={[styles.reviewSub, !due && styles.reviewSubIdle]}>
          {due
            ? "Vài phút để giữ từ đã nhớ không bị quên"
            : `Luyện nhanh 10 từ${next ? ` · lịch ôn tới ${next.getDate()}/${next.getMonth() + 1}` : ""}`}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={22} color={due ? colors.white : colors.accent} />
    </Pressable>
  );
}

function Entry({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.entry, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.entryIcon}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <View style={styles.entryText}>
        <Text style={styles.entryTitle}>{title}</Text>
        <Text style={styles.entrySub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: { width: 30, height: 48 },
  brand: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: colors.accent },
  hello: { marginTop: spacing.xl, fontSize: 28, fontWeight: "700", color: colors.ink },
  progress: { marginTop: spacing.xs, color: colors.muted, fontSize: 15 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  goal: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.flameSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  goalIconMet: { backgroundColor: colors.gold },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  goalTitle: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  goalCount: { fontSize: 14, fontWeight: "800", color: colors.flameDeep },
  goalCountMet: { color: colors.gold },
  goalBar: { height: 8, borderRadius: 99, backgroundColor: colors.flameSoft, overflow: "hidden", marginTop: 8 },
  goalFill: { height: 8, borderRadius: 99, backgroundColor: colors.flame },
  goalFillMet: { backgroundColor: colors.gold },
  goalSub: { marginTop: 6, fontSize: 13, color: colors.muted },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  review: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  reviewIdle: { backgroundColor: colors.surface },
  reviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewIconIdle: { backgroundColor: colors.accent },
  placement: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: "dashed",
  },
  placementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  placementTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  placementSub: { marginTop: 2, fontSize: 13, color: colors.muted },
  reviewTitle: { fontSize: 17, fontWeight: "700", color: colors.white },
  reviewTitleIdle: { color: colors.ink },
  reviewSub: { marginTop: 2, color: colors.accentSoft, fontSize: 13 },
  reviewSubIdle: { color: colors.muted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  entry: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md + 4 },
  pressed: { opacity: 0.6 },
  entryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  entryText: { flex: 1 },
  entryTitle: { fontSize: 19, fontWeight: "700", color: colors.ink },
  entrySub: { marginTop: 4, color: colors.muted },
});
