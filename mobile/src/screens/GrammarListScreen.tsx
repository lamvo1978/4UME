import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { api, GrammarLesson } from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

const LEVEL_NAMES: Record<string, string> = {
  A1: "A1 · Mới bắt đầu",
  A2: "A2 · Sơ cấp",
  B1: "B1 · Trung cấp",
  B2: "B2 · Trung cao cấp",
};

export function GrammarListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [lessons, setLessons] = useState<GrammarLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        setError("");
        try {
          const data = await api.grammarLessons();
          if (active) setLessons(data);
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Lỗi tải ngữ pháp");
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
    const byLevel = new Map<string, GrammarLesson[]>();
    for (const l of lessons) byLevel.set(l.level, [...(byLevel.get(l.level) ?? []), l]);
    return [...byLevel.entries()].map(([level, data]) => ({
      level,
      done: data.filter((l) => l.bestScore != null).length,
      data,
    }));
  }, [lessons]);

  const numbers = useMemo(() => new Map(lessons.map((l, i) => [l.slug, i + 1])), [lessons]);

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && lessons.length === 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{LEVEL_NAMES[section.level] ?? section.level}</Text>
            <Text style={styles.sectionCount}>
              {section.done}/{section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <LessonCard
            lesson={item}
            index={numbers.get(item.slug) ?? 0}
            onPress={() => navigation.navigate("GrammarLesson", { slug: item.slug, titleVi: item.titleVi })}
          />
        )}
      />
    </View>
  );
}

function LessonCard({ lesson, index, onPress }: { lesson: GrammarLesson; index: number; onPress: () => void }) {
  const attempted = lesson.bestScore != null && lesson.bestTotal != null;
  const passed = lesson.reviewLevel > 0;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.badge, passed && styles.badgeDone]}>
        {passed ? (
          <Ionicons name="checkmark" size={22} color={colors.white} />
        ) : (
          <Text style={styles.badgeText}>{index}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {lesson.titleVi}
        </Text>
        <View style={styles.metaRow}>
          {lesson.titleEn ? <Text style={styles.meta}>{lesson.titleEn}</Text> : null}
          {passed ? <Text style={styles.reviewTag}>Đang ôn</Text> : null}
        </View>
      </View>
      {attempted ? (
        <Text style={[styles.score, passed && styles.scorePassed]}>
          {lesson.bestScore}/{lesson.bestTotal}
        </Text>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loader: { marginTop: 40 },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: spacing.md,
    marginBottom: 2,
  },
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
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDone: { backgroundColor: colors.accent },
  badgeText: { fontSize: 17, fontWeight: "700", color: colors.accent },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  meta: { fontSize: 13, color: colors.muted },
  reviewTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  score: { fontSize: 14, fontWeight: "700", color: colors.muted },
  scorePassed: { color: colors.accent },
  error: { color: colors.danger, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
});
