import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ComponentProps, useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ReviewSummary } from "../api/client";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useHubTab } from "../navigation/useHubTab";
import { colors, fonts, shadow, spacing } from "../theme";
import { deckIcon } from "../vocabulary/deckMeta";

const TABS = [
  { key: "vocab", label: "Từ vựng" },
  { key: "grammar", label: "Ngữ pháp" },
] as const;

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type IconName = ComponentProps<typeof Ionicons>["name"];

type PanelData = {
  summary: ReviewSummary;
  topics: { key: string; icon: IconName; title: string; subtitle: string; onPress: () => void }[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function PracticeHubScreen() {
  const [tab, setTab] = useHubTab();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Ôn tập</Text>
        <Segmented items={TABS} value={tab} onChange={setTab} />
      </View>
      {tab === "vocab" ? <VocabPractice /> : <GrammarPractice />}
    </Screen>
  );
}

/** Loads panel data every time the tab gains focus (progress changes elsewhere). */
function usePanelData(load: () => Promise<PanelData>) {
  const [data, setData] = useState<PanelData | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError("");
      load()
        .then((d) => active && setData(d))
        .catch((e) => active && setError(e instanceof Error ? e.message : "Không tải được dữ liệu"));
      return () => {
        active = false;
      };
    }, [load])
  );

  return { data, error };
}

function VocabPractice() {
  const navigation = useNavigation<Nav>();
  const load = useCallback(async (): Promise<PanelData> => {
    const [summary, decks] = await Promise.all([api.reviewSummary(), api.decks()]);
    return {
      summary,
      topics: decks
        .filter((d) => d.knownWords > 0)
        .map((d) => ({
          key: d.id,
          icon: deckIcon(d),
          title: d.titleVi,
          subtitle: `${d.knownWords} từ đã nhớ`,
          onPress: () => navigation.navigate("Review", { mode: "practice", deckId: d.id, title: d.titleVi }),
        })),
    };
  }, [navigation]);
  const { data, error } = usePanelData(load);

  return (
    <ReviewPanel
      data={data}
      error={error}
      unit="từ"
      empty={{
        title: "Chưa có từ để ôn",
        sub: 'Học từ vựng và bấm "Đã nhớ", từ đó sẽ xuất hiện ở đây để ôn và luyện tập.',
        action: "Đi học từ vựng",
        onPress: () => navigation.navigate("Study", { tab: "vocab" }),
      }}
      onDue={() => navigation.navigate("Review", { mode: "due" })}
      quick={{
        title: "Luyện nhanh 10 từ",
        subtitle: "Ưu tiên từ hay quên, còn lại chọn ngẫu nhiên",
        onPress: () => navigation.navigate("Review", { mode: "practice", title: "Luyện thêm" }),
      }}
      topicsTitle="Luyện theo chủ đề"
    />
  );
}

function GrammarPractice() {
  const navigation = useNavigation<Nav>();
  const load = useCallback(async (): Promise<PanelData> => {
    const [summary, lessons] = await Promise.all([api.grammarReviewSummary(), api.grammarLessons()]);
    return {
      summary,
      topics: lessons
        .filter((l) => l.reviewLevel > 0)
        .map((l) => ({
          key: l.slug,
          icon: "document-text-outline" as IconName,
          title: l.titleVi,
          subtitle: `${l.level} · cấp ôn ${Math.min(l.reviewLevel, 5)}`,
          onPress: () => navigation.navigate("GrammarReview", { mode: "practice", slug: l.slug, title: l.titleVi }),
        })),
    };
  }, [navigation]);
  const { data, error } = usePanelData(load);

  return (
    <ReviewPanel
      data={data}
      error={error}
      unit="bài"
      empty={{
        title: "Chưa có bài để ôn",
        sub: "Hoàn thành bài học ngữ pháp (đúng từ 70%), bài đó sẽ được đưa vào lịch ôn.",
        action: "Đi học ngữ pháp",
        onPress: () => navigation.navigate("Study", { tab: "grammar" }),
      }}
      onDue={() => navigation.navigate("GrammarReview", { mode: "due" })}
      quick={{
        title: "Luyện nhanh",
        subtitle: "Trộn câu hỏi từ vài bài, ưu tiên bài hay sai",
        onPress: () => navigation.navigate("GrammarReview", { mode: "practice", title: "Luyện ngữ pháp" }),
      }}
      topicsTitle="Luyện theo bài"
    />
  );
}

function ReviewPanel({
  data,
  error,
  unit,
  empty,
  onDue,
  quick,
  topicsTitle,
}: {
  data: PanelData | null;
  error: string;
  unit: string;
  empty: { title: string; sub: string; action: string; onPress: () => void };
  onDue: () => void;
  quick: { title: string; subtitle: string; onPress: () => void };
  topicsTitle: string;
}) {
  if (!data) {
    return error ? (
      <Text style={[styles.error, styles.content]}>{error}</Text>
    ) : (
      <ActivityIndicator color={colors.accent} style={styles.loader} />
    );
  }

  const { summary, topics } = data;
  const due = summary.dueCount;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {summary.inReview === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="sparkles-outline" size={28} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptySub}>{empty.sub}</Text>
          <Pressable style={styles.primaryBtn} onPress={empty.onPress}>
            <Text style={styles.primaryBtnText}>{empty.action}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.hero, due === 0 && styles.heroIdle, pressed && styles.pressed]}
            disabled={due === 0}
            onPress={onDue}
          >
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, due === 0 && styles.heroIconIdle]}>
                <Ionicons name={due ? "repeat" : "checkmark-done"} size={24} color={due ? colors.accent : colors.white} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.heroTitle, due === 0 && styles.heroTitleIdle]}>
                  {due ? `Ôn tập hôm nay · ${due} ${unit}` : "Đã ôn xong hôm nay"}
                </Text>
                <Text style={[styles.heroSub, due === 0 && styles.heroSubIdle]}>
                  {due
                    ? "Theo lịch ôn cách quãng, giúp nhớ lâu"
                    : summary.nextDueAt
                      ? `Lần ôn tới: ngày ${formatDate(summary.nextDueAt)}`
                      : "Chưa có lịch ôn tiếp theo"}
                </Text>
              </View>
              {due ? <Ionicons name="arrow-forward" size={22} color={colors.white} /> : null}
            </View>
          </Pressable>

          <View style={styles.stats}>
            <Stat value={summary.inReview} label="Đang ôn" />
            <Stat value={due} label="Đến hạn" />
            <Stat value={summary.mastered} label="Đã thuộc" />
          </View>

          <Text style={styles.section}>Luyện thêm</Text>
          <Text style={styles.sectionSub}>Không ảnh hưởng lịch ôn. Làm bao nhiêu lần cũng được.</Text>
          <ActionCard icon="flash-outline" title={quick.title} subtitle={quick.subtitle} onPress={quick.onPress} />

          {topics.length > 0 ? (
            <>
              <Text style={[styles.section, styles.sectionGap]}>{topicsTitle}</Text>
              <View style={styles.topicList}>
                {topics.map((t) => (
                  <ActionCard key={t.key} icon={t.icon} title={t.title} subtitle={t.subtitle} compact onPress={t.onPress} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  compact,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.action, compact && styles.actionCompact, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.actionIcon, compact && styles.actionIconCompact]}>
        <Ionicons name={icon} size={compact ? 22 : 26} color={colors.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </View>
      <Ionicons name="play-circle" size={compact ? 28 : 34} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  loader: { marginTop: 40 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  hero: { padding: spacing.md, borderRadius: 22, backgroundColor: colors.accent, ...shadow.card },
  heroIdle: { backgroundColor: colors.surface },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconIdle: { backgroundColor: colors.accent },
  heroTitle: { fontSize: 17, fontWeight: "700", color: colors.white },
  heroTitleIdle: { color: colors.ink },
  heroSub: { marginTop: 2, fontSize: 13, color: colors.accentSoft },
  heroSubIdle: { color: colors.muted },
  stats: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.04,
  },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.accent },
  statLabel: { marginTop: 2, fontSize: 12, fontWeight: "600", color: colors.muted },
  section: { marginTop: spacing.lg, fontSize: 18, fontWeight: "700", color: colors.ink },
  sectionGap: { marginBottom: spacing.sm },
  sectionSub: { marginTop: 2, marginBottom: spacing.sm, fontSize: 13, color: colors.muted },
  topicList: { gap: 10 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  actionCompact: { padding: 12, borderRadius: 18 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconCompact: { width: 44, height: 44, borderRadius: 22 },
  actionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  actionSub: { marginTop: 2, fontSize: 13, color: colors.muted },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
