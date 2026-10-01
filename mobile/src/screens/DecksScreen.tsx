import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, Deck } from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

const LEVELS = ["Tất cả", "A1", "A2", "B1", "B2"] as const;

export function DecksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Tất cả");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        setError("");
        try {
          const data = await api.decks(level === "Tất cả" ? undefined : level);
          if (active) setDecks(data);
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Lỗi tải bộ từ");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [level])
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Bộ từ vựng</Text>
      <View style={styles.filters}>
        {LEVELS.map((l) => (
          <Pressable
            key={l}
            style={[styles.chip, level === l && styles.chipActive]}
            onPress={() => setLevel(l)}
          >
            <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const pct = item.totalWords ? Math.round((item.knownWords / item.totalWords) * 100) : 0;
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate("Flashcard", { deckId: item.id, titleVi: item.titleVi })
              }
            >
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{item.titleVi}</Text>
                <Text style={styles.count}>
                  {item.knownWords}/{item.totalWords}
                </Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink, marginBottom: spacing.md },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rowTitle: { fontSize: 17, fontWeight: "600", color: colors.ink, flex: 1, paddingRight: 8 },
  count: { color: colors.muted },
  barBg: { height: 6, backgroundColor: colors.accentSoft, borderRadius: 99, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.accent },
  error: { color: "#8B3A2A", marginBottom: 8 },
});
