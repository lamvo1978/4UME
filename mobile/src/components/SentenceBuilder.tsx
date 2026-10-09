import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { shuffle } from "../utils/shuffle";
import { AssembleControls } from "./AssembleControls";

type Chip = { id: number; text: string };

export function sentenceTokens(sentence: string) {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/** Remount (via `key`) for each new exercise; the chips are shuffled once per mount. */
type Props = {
  sentence: string;
  /** Extra words that don't belong in the sentence. */
  distractors?: string[];
  locked: boolean;
  onCheck: (answer: string, hintsUsed: number) => void;
  onReveal: () => void;
};

export function SentenceBuilder({ sentence, distractors, locked, onCheck, onReveal }: Props) {
  const target = useMemo(() => sentenceTokens(sentence), [sentence]);
  const [chips] = useState<Chip[]>(() =>
    shuffle([...target, ...(distractors ?? [])].map((text, id) => ({ id, text })))
  );
  const [picked, setPicked] = useState<number[]>([]);
  const [hints, setHints] = useState(0);

  const byId = (id: number) => chips.find((c) => c.id === id)!;
  const answerTexts = picked.map((id) => byId(id).text);

  function add(chip: Chip) {
    if (!locked) setPicked((p) => [...p, chip.id]);
  }

  function remove(id: number) {
    if (!locked) setPicked((p) => p.filter((x) => x !== id));
  }

  /** Keeps the longest correct prefix, then appends the next correct word. */
  function hint() {
    if (locked) return;
    let keep = 0;
    while (keep < picked.length && answerTexts[keep] === target[keep]) keep++;
    if (keep >= target.length) return;
    const kept = picked.slice(0, keep);
    const next = chips.find((c) => c.text === target[keep] && !kept.includes(c.id));
    if (!next) return;
    setPicked([...kept, next.id]);
    setHints((h) => h + 1);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.answer, locked && styles.answerLocked]}>
        {picked.length === 0 ? <Text style={styles.placeholder}>Chạm vào các từ bên dưới</Text> : null}
        {picked.map((id, i) => {
          const right = answerTexts[i] === target[i];
          return (
            <Pressable
              key={id}
              onPress={() => remove(id)}
              style={[styles.chip, locked && (right ? styles.chipRight : styles.chipWrong)]}
            >
              <Text style={[styles.chipText, locked && !right && styles.chipTextWrong]}>{byId(id).text}</Text>
            </Pressable>
          );
        })}
      </View>

      {!locked ? (
        <>
          <View style={styles.bank}>
            {chips.map((c) => {
              const taken = picked.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  disabled={taken}
                  onPress={() => add(c)}
                  style={({ pressed }) => [styles.chip, taken && styles.chipTaken, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, taken && styles.chipTextTaken]}>{c.text}</Text>
                </Pressable>
              );
            })}
          </View>
          <AssembleControls
            hints={hints}
            canCheck={picked.length === target.length}
            onHint={hint}
            onClear={() => setPicked([])}
            onReveal={onReveal}
            onCheck={() => onCheck(answerTexts.join(" "), hints)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  answer: {
    minHeight: 64,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: colors.border,
  },
  answerLocked: { borderColor: "transparent" },
  placeholder: { color: colors.muted, fontSize: 15 },
  bank: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.border,
  },
  chipTaken: { backgroundColor: colors.bgAlt, borderColor: colors.bgAlt },
  chipRight: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  chipText: { fontSize: 17, fontWeight: "600", color: colors.ink },
  chipTextTaken: { color: "transparent" },
  chipTextWrong: { color: colors.danger },
  pressed: { opacity: 0.7 },
});
