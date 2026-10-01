import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../theme";

export function ProfileScreen() {
  const { me, user, logout, refreshMe } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.name}>{me?.displayName ?? user?.displayName}</Text>
      <Text style={styles.email}>{me?.email ?? user?.email}</Text>

      <View style={styles.block}>
        <Row label="Từ đã nhớ" value={String(me?.knownWords ?? 0)} />
        <Row label="Đang khó" value={String(me?.hardWords ?? 0)} />
        <Row label="Bài ngữ pháp" value={`${me?.grammarLessonsCompleted ?? 0}/10`} />
      </View>

      <Pressable style={styles.refresh} onPress={() => refreshMe()}>
        <Text style={styles.refreshText}>Làm mới tiến trình</Text>
      </Pressable>
      <Pressable style={styles.logout} onPress={() => logout()}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  name: { fontSize: 28, fontWeight: "700", color: colors.ink, marginTop: spacing.lg },
  email: { color: colors.muted, marginBottom: spacing.lg },
  block: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: colors.muted },
  rowValue: { color: colors.ink, fontWeight: "700" },
  refresh: { marginTop: spacing.lg, alignItems: "center" },
  refreshText: { color: colors.accent, fontWeight: "600" },
  logout: { marginTop: spacing.md, alignItems: "center" },
  logoutText: { color: "#8B3A2A", fontWeight: "600" },
});
