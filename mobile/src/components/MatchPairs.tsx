import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { shuffle } from "../utils/shuffle";
import { speakAuto } from "./SpeakButton";

export type Pair = { id: string; word: string; meaning: string };

const WRONG_FLASH_MS = 450;

/** Remount (via `key`) for each new exercise. Pairs with identical meanings are interchangeable. */
type Props = {
  pairs: Pair[];
  onMistake: (wordId: string) => void;
  onDone: () => void;
};

export function MatchPairs({ pairs, onMistake, onDone }: Props) {
  const [left] = useState(() => shuffle(pairs));
  const [right] = useState(() => shuffle(pairs));
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [doneLeft, setDoneLeft] = useState<string[]>([]);
  const [doneRight, setDoneRight] = useState<string[]>([]);
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);

  useEffect(() => {
    if (doneLeft.length === pairs.length) onDone();
  }, [doneLeft.length]);

  useEffect(() => {
    if (!wrong) return;
    const t = setTimeout(() => setWrong(null), WRONG_FLASH_MS);
    return () => clearTimeout(t);
  }, [wrong]);

  function tryMatch(leftId: string | null, rightId: string | null) {
    setPickedLeft(leftId);
    setPickedRight(rightId);
    if (!leftId || !rightId) return;
    setPickedLeft(null);
    setPickedRight(null);
    const l = pairs.find((p) => p.id === leftId)!;
    const r = pairs.find((p) => p.id === rightId)!;
    if (l.meaning === r.meaning) {
      setDoneLeft((d) => [...d, l.id]);
      setDoneRight((d) => [...d, r.id]);
    } else {
      onMistake(l.id);
      setWrong({ left: l.id, right: r.id });
    }
  }

  function pickLeft(p: Pair) {
    speakAuto(p.word);
    tryMatch(pickedLeft === p.id ? null : p.id, pickedRight);
  }

  return (
    <View style={styles.root}>
      <View style={styles.column}>
        {left.map((p) => (
          <Card
            key={p.id}
            text={p.word}
            selected={pickedLeft === p.id}
            done={doneLeft.includes(p.id)}
            wrong={wrong?.left === p.id}
            onPress={() => pickLeft(p)}
          />
        ))}
      </View>
      <View style={styles.column}>
        {right.map((p) => (
          <Card
            key={p.id}
            text={p.meaning}
            selected={pickedRight === p.id}
            done={doneRight.includes(p.id)}
            wrong={wrong?.right === p.id}
            onPress={() => tryMatch(pickedLeft, pickedRight === p.id ? null : p.id)}
          />
        ))}
      </View>
    </View>
  );
}

function Card({
  text,
  selected,
  done,
  wrong,
  onPress,
}: {
  text: string;
  selected: boolean;
  done: boolean;
  wrong: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={done}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        wrong && styles.cardWrong,
        done && styles.cardDone,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.cardText, done && styles.cardTextDone, wrong && styles.cardTextWrong]} numberOfLines={3}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", gap: 10 },
  column: { flex: 1, gap: 10 },
  card: {
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  cardDone: { backgroundColor: colors.bgAlt, borderColor: colors.bgAlt },
  cardText: { fontSize: 16, fontWeight: "600", color: colors.ink, textAlign: "center" },
  cardTextDone: { color: colors.muted },
  cardTextWrong: { color: colors.danger },
  pressed: { opacity: 0.7 },
});
