import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api, Deck } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { deckIcon, levelRange } from "../vocabulary/deckMeta";

const LEVELS = ["Tất cả", "A1", "A2", "B1", "B2"] as const;

export function DecksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { me } = useAuth();
  const startLevel = me?.settings.vocabLevel ?? "Tất cả";
  const [decks, setDecks] = useState<Deck[]>([]);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>(startLevel);

  useEffect(() => setLevel(startLevel), [startLevel]);
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
      <Pressable
        style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        onPress={() => navigation.navigate("WordSearch")}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <Text style={styles.searchText}>Tìm từ: apple, quả táo…</Text>
      </Pressable>
      <View style={styles.filters}>
        {LEVELS.map((l) => {
          const active = level === l;
          return (
            <Pressable key={l} style={[styles.chip, active && styles.chipActive]} onPress={() => setLevel(l)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{l}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && decks.length === 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DeckCard
            deck={item}
            onPress={() => navigation.navigate("Flashcard", { deckId: item.id, titleVi: item.titleVi })}
          />
        )}
      />
    </View>
  );
}

function DeckCard({ deck, onPress }: { deck: Deck; onPress: () => void }) {
  const started = deck.knownWords + deck.hardWords > 0;
  const pct = deck.totalWords ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;
  const range = levelRange(deck.levels);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name={deckIcon(deck)} size={24} color={colors.accent} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {deck.titleVi}
        </Text>
        <Text style={styles.meta}>
          {deck.totalWords} từ{range ? ` · ${range}` : ""}
          {started ? ` · đã nhớ ${deck.knownWords}` : ""}
        </Text>
        {started ? (
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
        ) : null}
      </View>
      {started ? (
        <Text style={styles.pct}>{pct}%</Text>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchText: { color: colors.muted, fontSize: 15 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: "600", fontSize: 14 },
  chipTextActive: { color: colors.white },
  loader: { marginTop: 40 },
  list: { padding: spacing.lg, paddingTop: spacing.md, gap: 10 },
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
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  barBg: { height: 5, marginTop: 5, borderRadius: 99, backgroundColor: colors.accentSoft, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 99, backgroundColor: colors.accent },
  pct: { fontSize: 14, fontWeight: "700", color: colors.accent, minWidth: 40, textAlign: "right" },
  error: { color: colors.danger, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
});
