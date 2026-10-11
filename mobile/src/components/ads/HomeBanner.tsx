import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../../theme";

/**
 * The Home banner slot, pinned below the scroll so new cards never push it out of view. Until the AdMob SDK
 * ships with the EAS build this is a dev-only placeholder; swap the box for the anchored adaptive banner then.
 */
export function HomeBanner({ premium }: { premium: boolean | undefined }) {
  if (premium || !__DEV__) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Quảng cáo</Text>
      <View style={styles.box}>
        <Text style={styles.boxText}>Banner quảng cáo (giả lập)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  label: { fontSize: 10, fontWeight: "600", color: colors.muted, marginBottom: 2 },
  box: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  boxText: { fontSize: 12, color: colors.muted },
});
