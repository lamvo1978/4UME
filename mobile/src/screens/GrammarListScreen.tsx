import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api, GrammarLesson } from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

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

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Ngữ pháp căn bản</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={lessons}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate("GrammarLesson", { slug: item.slug, titleVi: item.titleVi })
            }
          >
            <View>
              <Text style={styles.rowTitle}>{item.titleVi}</Text>
              <Text style={styles.meta}>
                {item.level} · {item.exerciseCount} câu
                {item.bestScore != null ? ` · điểm cao ${item.bestScore}/${item.exerciseCount}` : ""}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { color: colors.muted, marginTop: 4 },
  chevron: { fontSize: 28, color: colors.accent },
  error: { color: "#8B3A2A" },
});
