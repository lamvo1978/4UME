import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.brand}>4UME</Text>
        <Text style={styles.subtitle}>Học từ và ngữ pháp mỗi ngày</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryText}>Đăng nhập</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.secondaryText}>Tạo tài khoản</Text>
        </Pressable>
        <Text style={styles.hint}>Dành cho bạn bè cùng học</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, justifyContent: "space-between", backgroundColor: colors.bg },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  brand: { fontSize: 56, fontWeight: "700", color: colors.ink, letterSpacing: 1 },
  subtitle: { marginTop: spacing.sm, fontSize: 17, color: colors.muted, textAlign: "center" },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: "600" },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.accent, fontSize: 17, fontWeight: "600" },
  hint: { textAlign: "center", color: colors.muted, marginTop: spacing.sm },
});
