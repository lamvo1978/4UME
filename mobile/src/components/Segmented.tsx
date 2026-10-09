import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Props<K extends string> = {
  items: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

export function Segmented<K extends string>({ items, value, onChange }: Props<K>) {
  return (
    <View style={styles.segment}>
      {items.map((t) => {
        const active = value === t.key;
        return (
          <Pressable
            key={t.key}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(t.key)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    backgroundColor: colors.bgAlt,
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center" },
  segmentItemActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { color: colors.muted, fontWeight: "600", fontSize: 15 },
  segmentTextActive: { color: colors.accent, fontWeight: "700" },
});
