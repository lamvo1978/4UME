import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, PronunciationStatus, Stats } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { NameSheet } from "../components/profile/AccountSheets";
import { ActivityCalendar } from "../components/profile/ActivityCalendar";
import { MemoryCard } from "../components/profile/MemoryCard";
import { PlanRow } from "../components/profile/PlanRow";
import { StreakCard } from "../components/profile/StreakCard";
import { Screen } from "../components/Screen";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, spacing } from "../theme";
import { formatMonthYear } from "../utils/dates";

export function ProfileScreen() {
  const { me, user, refreshMe } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [plan, setPlan] = useState<PronunciationStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const name = me?.displayName ?? user?.displayName;

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api.stats(), api.pronunciationStatus().catch(() => null), refreshMe()]);
      setStats(s);
      setPlan(p);
    } catch {
      // Keep showing the last stats; pull-to-refresh retries.
    }
  }, [refreshMe]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Hồ sơ</Text>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate("Settings")}
            hitSlop={8}
            accessibilityLabel="Cài đặt"
          >
            <Ionicons name="settings-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.user}>
          <Avatar name={name} size={64} />
          <View style={styles.userText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {me?.email ?? user?.email}
            </Text>
            {stats ? <Text style={styles.since}>Thành viên từ {formatMonthYear(stats.memberSince)}</Text> : null}
          </View>
          <Pressable style={styles.iconButton} onPress={() => setEditingName(true)} hitSlop={8} accessibilityLabel="Đổi tên">
            <Ionicons name="create-outline" size={20} color={colors.accent} />
          </Pressable>
        </View>

        {plan && (plan.enabled || plan.premium) ? <PlanRow status={plan} onPress={() => navigation.navigate("Premium")} /> : null}

        {stats ? (
          <>
            <StreakCard streak={stats.streak} />

            <Section title="Hoạt động" />
            <ActivityCalendar today={stats.streak.today} days={stats.streak.days} totalDays={stats.totalStudyDays} />

            <Section title="Độ nhớ" hint="Từ và bài lên cấp mỗi lần ôn đúng; lên cấp 6 là đã thuộc." />
            <MemoryCard icon="book-outline" title="Từ vựng" unit="từ" learningLabel="Đang để học sau" memory={stats.vocabulary} />
            <View style={styles.gap} />
            <MemoryCard
              icon="document-text-outline"
              title="Ngữ pháp"
              unit="bài"
              learningLabel="Đã làm nhưng chưa đạt"
              memory={stats.grammar}
            />
          </>
        ) : (
          <View style={styles.placeholder} />
        )}
      </ScrollView>

      <NameSheet visible={editingName} current={name ?? ""} onClose={() => setEditingName(false)} />
    </Screen>
  );
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  user: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  userText: { flex: 1 },
  name: { fontSize: 22, fontWeight: "700", color: colors.ink },
  email: { marginTop: 2, color: colors.muted },
  since: { marginTop: 2, fontSize: 12, color: colors.muted },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: { height: 320, borderRadius: 24, backgroundColor: colors.surface, opacity: 0.6 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  sectionHint: { marginTop: 2, fontSize: 13, color: colors.muted },
  gap: { height: spacing.sm },
  pressed: { opacity: 0.6 },
});
