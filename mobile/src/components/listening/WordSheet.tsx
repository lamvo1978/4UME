import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, WordSearchResult } from "../../api/client";
import { colors, spacing } from "../../theme";
import { SpeakButton } from "../SpeakButton";

/** Meaning of a long-pressed word from the script, looked up in the app's own word bank. */
export function WordSheet({ word, onClose }: { word: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<WordSearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!word) return;
    let alive = true;
    setResult(null);
    setLoading(true);
    api
      .searchWords(word, 5)
      .then((list) => {
        if (!alive) return;
        const exact = list.find((r) => r.word.word.toLowerCase() === word || r.matchedForm?.toLowerCase() === word);
        setResult(exact ?? null);
      })
      .catch(() => alive && setResult(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [word]);

  const w = result?.word;

  return (
    <Modal visible={!!word} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.word}>{w?.word ?? word}</Text>
              {w ? (
                <Text style={styles.ipa}>
                  {[w.ipa, w.pos].filter(Boolean).join(" · ")}
                  {result?.matchedForm ? ` · dạng của "${w.word}"` : ""}
                </Text>
              ) : null}
            </View>
            {word ? <SpeakButton text={w?.word ?? word} /> : null}
          </View>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : w ? (
            <View style={styles.body}>
              <Text style={styles.meaning}>{w.meaningVi}</Text>
              {w.forms ? <Text style={styles.forms}>{w.forms}</Text> : null}
              {w.example ? (
                <View style={styles.example}>
                  <Text style={styles.exampleEn}>{w.example}</Text>
                  {w.exampleVi ? <Text style={styles.exampleVi}>{w.exampleVi}</Text> : null}
                </View>
              ) : null}
              <Text style={styles.deck}>Trong bộ: {result?.deckTitleVi}</Text>
            </View>
          ) : (
            <Text style={styles.missing}>Từ này chưa có trong kho từ của 4UME.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26,46,40,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  word: { fontSize: 24, fontWeight: "800", color: colors.ink },
  ipa: { fontSize: 14, color: colors.muted },
  loader: { marginVertical: spacing.md },
  body: { gap: spacing.sm },
  meaning: { fontSize: 18, fontWeight: "700", color: colors.accent },
  forms: { fontSize: 13, color: colors.muted },
  example: { backgroundColor: colors.bg, borderRadius: 14, padding: 12, gap: 4 },
  exampleEn: { fontSize: 15, color: colors.ink },
  exampleVi: { fontSize: 13, color: colors.muted },
  deck: { fontSize: 12, color: colors.muted },
  missing: { fontSize: 15, color: colors.muted },
});
