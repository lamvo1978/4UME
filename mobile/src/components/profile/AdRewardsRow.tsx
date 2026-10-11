import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PronunciationStatus } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";

/** Entry to the rewarded-ads screen under the plan row; only rendered when ads are offered. */
export function AdRewardsRow({ status, onPress }: { status: PronunciationStatus; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Thêm lượt kiểm tra</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          Còn {status.remaining} lượt hôm nay · xem quảng cáo +1 lượt
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
