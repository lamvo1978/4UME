import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, Word } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Flashcard">;

const STATUS = { New: 0, Hard: 1, Known: 2 } as const;

export function FlashcardScreen({ route }: Props) {
  const { deckId, titleVi } = route.params;
  const { refreshMe } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setWords(await api.deckWords(deckId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được từ");
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId]);

  const queue = useMemo(() => words, [words]);
  const current = queue[index];

  async function rate(status: number) {
    if (!current) return;
    await api.updateProgress(current.id, status);
    setFlipped(false);
    if (status === STATUS.New || status === STATUS.Hard) {
      setWords((prev) => {
        const next = [...prev];
        const [item] = next.splice(index, 1);
        next.push({ ...item, status });
        return next;
      });
      if (index >= queue.length - 1) setIndex(0);
    } else {
      if (index >= queue.length - 1) setIndex(0);
      else setIndex((i) => i + 1);
    }
    await refreshMe();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !current) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Hết từ trong bộ này."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.deck}>{titleVi}</Text>
      <Text style={styles.progress}>
        {index + 1} / {queue.length}
      </Text>

      <Pressable style={styles.card} onPress={() => setFlipped((f) => !f)}>
        {!flipped ? (
          <>
            <Text style={styles.word}>{current.word}</Text>
            <Text style={styles.ipa}>{current.ipa}</Text>
            <Text style={styles.pos}>{current.pos}</Text>
            <Text style={styles.hint}>Chạm để xem nghĩa</Text>
          </>
        ) : (
          <>
            <Text style={styles.meaning}>{current.meaningVi}</Text>
            <Text style={styles.example}>{current.example}</Text>
            <Text style={styles.exampleVi}>{current.exampleVi}</Text>
          </>
        )}
      </Pressable>

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnMuted]} onPress={() => rate(STATUS.New)}>
          <Text style={styles.btnMutedText}>Chưa nhớ</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => rate(STATUS.Hard)}>
          <Text style={styles.btnOutlineText}>Khó</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => rate(STATUS.Known)}>
          <Text style={styles.btnPrimaryText}>Đã nhớ</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  deck: { fontSize: 18, fontWeight: "700", color: colors.ink },
  progress: { color: colors.muted, marginBottom: spacing.md },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  word: { fontSize: 40, fontWeight: "700", color: colors.ink },
  ipa: { marginTop: 8, fontSize: 18, color: colors.muted },
  pos: { marginTop: 6, color: colors.accent, fontWeight: "600" },
  hint: { marginTop: spacing.lg, color: colors.muted },
  meaning: { fontSize: 28, fontWeight: "700", color: colors.accent, textAlign: "center" },
  example: { marginTop: spacing.md, fontSize: 17, color: colors.ink, textAlign: "center" },
  exampleVi: { marginTop: 8, fontSize: 15, color: colors.muted, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnMuted: { backgroundColor: colors.dangerSoft },
  btnMutedText: { color: colors.ink, fontWeight: "600" },
  btnOutline: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.surface },
  btnOutlineText: { color: colors.accent, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "600" },
  error: { color: "#8B3A2A" },
});
