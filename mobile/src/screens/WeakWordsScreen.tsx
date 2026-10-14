import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorRetry } from "../components/ErrorRetry";
import { api, WEAK_SPEAK_SCORE, WeakWord } from "../api/client";
import { speak } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WeakWordsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<WeakWord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.weakWords());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!items) {
    return (
      <View style={styles.center}>
        {error ? <ErrorRetry message={error} onRetry={load} /> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      data={items}
      keyExtractor={(w) => w.wordId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        items.length > 0 ? (
          <View style={styles.header}>
            <Text style={styles.intro}>
              Những từ bạn hay quên hoặc đọc chưa chuẩn. Trả lời đúng ngay vài lần liền, đọc đạt từ {WEAK_SPEAK_SCORE} điểm là
              từ tự rời danh sách. Chạm vào từ để nghe.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]}
              onPress={() => navigation.navigate("Review", { mode: "practice", weak: true, title: "Ôn từ hay sai" })}
            >
              <Ionicons name="fitness-outline" size={20} color={colors.white} />
              <Text style={styles.startText}>Ôn ngay</Text>
            </Pressable>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-circle-outline" size={44} color={colors.accent} />
          <Text style={styles.emptyTitle}>Không còn từ hay sai</Text>
          <Text style={styles.emptyText}>Từ nào bạn trả lời sai khi ôn sẽ xuất hiện ở đây để luyện lại.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => speak(item.word)}>
          <View style={styles.text}>
            <Text style={styles.word}>
              {item.word} {item.ipa ? <Text style={styles.ipa}>{item.ipa}</Text> : null}
            </Text>
            <Text style={styles.meaning} numberOfLines={2}>
              {item.meaningVi}
            </Text>
          </View>
          <View style={styles.tags}>
            {item.weakScore > 0 ? (
              <View style={[styles.tag, styles.tagForgot]}>
                <Text style={[styles.tagText, styles.tagForgotText]}>Hay quên</Text>
              </View>
            ) : null}
            {item.speakScore != null && item.speakScore < WEAK_SPEAK_SCORE ? (
              <View style={[styles.tag, styles.tagSpeak]}>
                <Text style={[styles.tagText, styles.tagSpeakText]}>Đọc {item.speakScore} điểm</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.danger, textAlign: "center" },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 14,
  },
  startText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    ...shadow.card,
  },
  text: { flex: 1, gap: 2 },
  word: { fontSize: 17, fontWeight: "700", color: colors.ink },
  ipa: { fontSize: 14, fontWeight: "400", color: colors.muted },
  meaning: { fontSize: 14, color: colors.muted },
  tags: { alignItems: "flex-end", gap: 4 },
  tag: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 12, fontWeight: "700" },
  tagForgot: { backgroundColor: colors.dangerSoft },
  tagForgotText: { color: colors.danger },
  tagSpeak: { backgroundColor: colors.flameSoft },
  tagSpeakText: { color: colors.flameDeep },
  pressed: { opacity: 0.6 },
});
