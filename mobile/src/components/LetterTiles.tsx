import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { shuffle } from "../utils/shuffle";
import { AssembleControls } from "./AssembleControls";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const DECOYS = 3;

type Tile = { id: number; char: string };
type Slot = { char: string | null; tileId: number | null; hinted: boolean; fixed: boolean };

/** Letters become slots; spaces, hyphens and apostrophes are shown pre-filled. */
function makePuzzle(word: string) {
  const target = word.toLowerCase();
  const slots: Slot[] = [...target].map((c) =>
    /[a-z]/.test(c)
      ? { char: null, tileId: null, hinted: false, fixed: false }
      : { char: c, tileId: null, hinted: false, fixed: true }
  );
  const letters = [...target].filter((c) => /[a-z]/.test(c));
  const decoys = shuffle([...ALPHABET].filter((c) => !letters.includes(c))).slice(0, DECOYS);
  const tiles = shuffle([...letters, ...decoys]).map((char, id) => ({ id, char }));
  return { target, slots, tiles };
}

/** Remount (via `key`) for each new exercise; the puzzle is built once per mount. */
type Props = {
  word: string;
  locked: boolean;
  onCheck: (answer: string, hintsUsed: number) => void;
  onReveal: () => void;
};

export function LetterTiles({ word, locked, onCheck, onReveal }: Props) {
  const puzzle = useMemo(() => makePuzzle(word), [word]);
  const [slots, setSlots] = useState<Slot[]>(puzzle.slots);
  const [hints, setHints] = useState(0);

  const used = new Set(slots.map((s) => s.tileId).filter((id): id is number => id !== null));
  const nextEmpty = slots.findIndex((s) => !s.fixed && s.char === null);

  function place(tile: Tile) {
    if (locked || nextEmpty === -1) return;
    setSlots((prev) => prev.map((s, i) => (i === nextEmpty ? { ...s, char: tile.char, tileId: tile.id } : s)));
  }

  function remove(index: number) {
    const slot = slots[index];
    if (locked || slot.fixed || slot.hinted || slot.char === null) return;
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, char: null, tileId: null } : s)));
  }

  /** Clears wrong letters, then fills the first unsolved slot with the correct letter. */
  function hint() {
    if (locked) return;
    const cleaned = slots.map((s, i) =>
      !s.fixed && !s.hinted && s.char !== null && s.char !== puzzle.target[i] ? { ...s, char: null, tileId: null } : s
    );
    const index = cleaned.findIndex((s, i) => !s.fixed && s.char !== puzzle.target[i]);
    if (index === -1) return;
    const takenIds = new Set(cleaned.map((s) => s.tileId).filter((id) => id !== null));
    const tile =
      puzzle.tiles.find((t) => t.char === puzzle.target[index] && !takenIds.has(t.id)) ??
      puzzle.tiles.find((t) => t.char === puzzle.target[index]);
    if (!tile) return;
    setSlots(
      cleaned.map((s, i) => {
        if (i === index) return { ...s, char: tile.char, tileId: tile.id, hinted: true };
        if (s.tileId === tile.id) return { ...s, char: null, tileId: null };
        return s;
      })
    );
    setHints((h) => h + 1);
  }

  function clear() {
    if (locked) return;
    setSlots((prev) => prev.map((s) => (s.fixed || s.hinted ? s : { ...s, char: null, tileId: null })));
  }

  return (
    <View style={styles.root}>
      <View style={styles.slots}>
        {slots.map((s, i) => {
          if (s.fixed) {
            return (
              <View key={i} style={styles.gap}>
                <Text style={styles.fixedChar}>{s.char === " " ? "" : s.char}</Text>
              </View>
            );
          }
          const right = s.char === puzzle.target[i];
          return (
            <Pressable
              key={i}
              onPress={() => remove(i)}
              style={[
                styles.slot,
                i === nextEmpty && !locked && styles.slotActive,
                s.hinted && styles.slotHinted,
                locked && (right ? styles.slotRight : styles.slotWrong),
              ]}
            >
              <Text style={[styles.slotChar, s.hinted && styles.slotCharHinted, locked && !right && styles.slotCharWrong]}>
                {s.char ?? ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!locked ? (
        <>
          <View style={styles.tiles}>
            {puzzle.tiles.map((t) => {
              const taken = used.has(t.id);
              return (
                <Pressable
                  key={t.id}
                  disabled={taken}
                  onPress={() => place(t)}
                  style={({ pressed }) => [styles.tile, taken && styles.tileTaken, pressed && styles.pressed]}
                >
                  <Text style={[styles.tileChar, taken && styles.tileCharTaken]}>{t.char}</Text>
                </Pressable>
              );
            })}
          </View>
          <AssembleControls
            hints={hints}
            canCheck={nextEmpty === -1}
            onHint={hint}
            onClear={clear}
            onReveal={onReveal}
            onCheck={() => onCheck(slots.map((s) => s.char).join(""), hints)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  slots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  slot: {
    width: 36,
    height: 44,
    borderRadius: 10,
    borderBottomWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  slotActive: { borderColor: colors.accent },
  slotHinted: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  slotRight: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  slotWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  slotChar: { fontSize: 22, fontWeight: "700", color: colors.ink },
  slotCharHinted: { color: colors.accent },
  slotCharWrong: { color: colors.danger },
  gap: { width: 14, height: 44, alignItems: "center", justifyContent: "center" },
  fixedChar: { fontSize: 22, fontWeight: "700", color: colors.muted },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTaken: { backgroundColor: colors.bgAlt, borderColor: colors.bgAlt },
  tileChar: { fontSize: 22, fontWeight: "700", color: colors.ink },
  tileCharTaken: { color: "transparent" },
  pressed: { opacity: 0.7 },
});
