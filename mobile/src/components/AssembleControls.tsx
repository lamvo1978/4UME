import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

type Props = {
  hints: number;
  canCheck: boolean;
  onHint: () => void;
  onClear: () => void;
  onReveal: () => void;
  onCheck: () => void;
};

/** Shared toolbar for the letter and sentence puzzles. */
export function AssembleControls({ hints, canCheck, onHint, onClear, onReveal, onCheck }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.tools}>
        <Tool icon="bulb-outline" label={hints ? `Gợi ý (${hints})` : "Gợi ý"} onPress={onHint} />
        <Tool icon="backspace-outline" label="Xóa hết" onPress={onClear} />
        <Tool icon="eye-outline" label="Xem đáp án" onPress={onReveal} />
      </View>
      <Pressable
        style={({ pressed }) => [styles.check, !canCheck && styles.disabled, pressed && styles.pressed]}
        disabled={!canCheck}
        onPress={onCheck}
      >
        <Text style={styles.checkText}>Kiểm tra</Text>
      </Pressable>
    </View>
  );
}

function Tool({
  icon,
  label,
  onPress,
}: {
  icon: "bulb-outline" | "backspace-outline" | "eye-outline";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]} hitSlop={6}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  tools: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  tool: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  toolText: { color: colors.accent, fontWeight: "700" },
  check: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  checkText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
