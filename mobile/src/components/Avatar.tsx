import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function Avatar({ name, size = 44 }: { name?: string; size?: number }) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  initial: { color: colors.accent, fontWeight: "700" },
});
