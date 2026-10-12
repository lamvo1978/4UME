import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, shadow, spacing } from "../../theme";

/** Entry to the invite screen, which also holds the box for invite and partner-centre codes. */
export function InviteRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="gift" size={17} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Mời bạn bè</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          Cùng nhận ngày Premium · nhập mã mời hoặc mã trung tâm
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  subtitle: { marginTop: 1, fontSize: 12, color: colors.muted },
  pressed: { opacity: 0.6 },
});
