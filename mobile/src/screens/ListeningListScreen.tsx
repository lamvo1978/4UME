import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { api, ListeningKind, ListeningSummary } from "../api/client";
import { formatClock, KIND_META } from "../listening/meta";
import { Screen } from "../components/Screen";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, shadow, spacing } from "../theme";

const LEVEL_NAMES: Record<string, string> = {
  A1: "A1 · Mới bắt đầu",
  A2: "A2 · Sơ cấp",
  B1: "B1 · Trung cấp",
  B2: "B2 · Trung cao cấp",
};

const FILTERS: { key: "all" | ListeningKind; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "dialogue", label: KIND_META.dialogue.label },
  { key: "story", label: KIND_META.story.label },
  { key: "news", label: KIND_META.news.label },
];

export function ListeningListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [lessons, setLessons] = useState<ListeningSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | ListeningKind>("all");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        setError("");
        try {
          const data = await api.listeningLessons();
          if (active) setLessons(data);
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Lỗi tải bài nghe");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const sections = useMemo(() => {
    const byLevel = new Map<string, ListeningSummary[]>();
    for (const l of lessons) if (filter === "all" || l.kind === filter) byLevel.set(l.level, [...(byLevel.get(l.level) ?? []), l]);
    return [...byLevel.entries()].map(([level, data]) => ({
      level,
      done: data.filter((l) => l.progress.completed).length,
      data,
    }));
  }, [lessons, filter]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.heading}>Nghe</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && lessons.length === 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          lessons.length ? (
            <View style={styles.intro}>
              <Text style={styles.introText}>Nghe thoải mái, không chấm điểm. Chạm vào câu để nghe lại, nhấn giữ một từ để xem nghĩa.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                {FILTERS.map((f) => (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
                    <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{LEVEL_NAMES[section.level] ?? section.level}</Text>
            <Text style={styles.sectionCount}>
              {section.done}/{section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => <LessonCard lesson={item} onPress={() => navigation.navigate("Listening", { slug: item.slug, titleVi: item.titleVi })} />}
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>Chưa có bài nghe nào.</Text> : null}
      />
    </Screen>
  );
}

function LessonCard({ lesson, onPress }: { lesson: ListeningSummary; onPress: () => void }) {
  const kind = KIND_META[lesson.kind];
  const { completed, positionMs, liked } = lesson.progress;
  const resume = !completed && positionMs > 3000 && lesson.hasAudio;
  const meta = [lesson.titleEn, lesson.durationMs ? formatClock(lesson.durationMs) : `${lesson.lineCount} câu`].join(" · ");

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.badge, completed && styles.badgeDone]}>
        <Ionicons name={completed ? "checkmark" : kind.icon} size={22} color={completed ? colors.white : colors.accent} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {lesson.titleVi}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {resume ? <Text style={styles.resume}>Nghe tiếp từ {formatClock(positionMs)}</Text> : null}
      </View>
      {liked ? <Ionicons name="heart" size={18} color={colors.flameDeep} /> : <Ionicons name="play-circle" size={28} color={colors.accent} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  heading: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  loader: { marginTop: 40 },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: 10 },
  intro: { gap: spacing.sm, marginBottom: 2 },
  introText: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  filters: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.bgAlt },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.white },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: spacing.md, marginBottom: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  sectionCount: { fontSize: 13, fontWeight: "700", color: colors.muted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  pressed: { opacity: 0.7 },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  badgeDone: { backgroundColor: colors.accent },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  resume: { fontSize: 12, fontWeight: "700", color: colors.accent },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.xl },
  error: { color: colors.danger, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
});
