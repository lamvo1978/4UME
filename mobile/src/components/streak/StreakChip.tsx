import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme";

/** Compact flame + count; grey until the user studies today. */
export function StreakChip({ streak, studiedToday, onPress }: { streak: number; studiedToday: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.chip, studiedToday && styles.chipActive, pressed && styles.pressed]}
    >
      <Ionicons name="flame" size={20} color={studiedToday ? colors.flame : colors.idle} />
      <Text style={[styles.text, studiedToday && styles.textActive]}>{streak}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.flameSoft, borderColor: colors.flame },
  text: { fontSize: 16, fontWeight: "800", color: colors.muted },
  textActive: { color: colors.flameDeep },
  pressed: { opacity: 0.7 },
});
