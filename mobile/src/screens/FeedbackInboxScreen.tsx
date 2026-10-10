import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, FeedbackSummary } from "../api/client";
import { categoryLabel, shortTime, STATUS } from "../feedback/meta";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FeedbackInboxScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<FeedbackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.feedbackList());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được góp ý.");
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

  const newButton = (
    <Pressable
      style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
      onPress={() => navigation.navigate("FeedbackNew")}
    >
      <Ionicons name="create-outline" size={20} color={colors.white} />
      <Text style={styles.newText}>Gửi góp ý mới</Text>
    </Pressable>
  );

  if (!items) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      data={items}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.intro}>
            Góp ý, báo lỗi hay nội dung sai — 4UME đọc hết và trả lời ngay tại đây. Có trả lời mới, chuông ở Trang chủ sẽ hiện chấm đỏ.
          </Text>
          {newButton}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.idle} />
          <Text style={styles.emptyText}>Bạn chưa gửi góp ý nào.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => navigation.navigate("FeedbackThread", { id: item.id })}
        >
          <View style={styles.cardTop}>
            <Text style={styles.category}>{categoryLabel(item.category)}</Text>
            <Text style={styles.time}>{shortTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.subjectRow}>
            {item.unread ? <View style={styles.dot} /> : null}
            <Text style={[styles.subject, item.unread && styles.subjectUnread]} numberOfLines={2}>
              {item.subject}
            </Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={[styles.pill, { backgroundColor: STATUS[item.status].bg }]}>
              <Text style={[styles.pillText, { color: STATUS[item.status].fg }]}>{STATUS[item.status].label}</Text>
            </View>
            {item.wordText ? <Text style={styles.word}>Từ “{item.wordText}”</Text> : null}
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
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 14,
  },
  newText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, gap: 6, ...shadow.card },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  category: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  time: { fontSize: 12, color: colors.muted },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#E5484D" },
  subject: { flex: 1, fontSize: 16, color: colors.ink },
  subjectUnread: { fontWeight: "700" },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
  word: { fontSize: 12, color: colors.muted },
  pressed: { opacity: 0.6 },
});
