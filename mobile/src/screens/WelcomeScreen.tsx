import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { colors, fonts, spacing } from "../theme";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen edges={["top", "bottom", "left", "right"]} style={styles.root}>
      <View style={styles.hero}>
        <Image source={require("../../assets/logo-emblem.png")} style={styles.emblem} resizeMode="contain" />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.lg, justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },
  emblem: { width: 110, height: 180, marginBottom: spacing.md },
  brand: { fontFamily: fonts.display, fontSize: 56, fontWeight: "700", color: colors.accent, letterSpacing: 1 },
  subtitle: { marginTop: spacing.sm, fontSize: 17, color: colors.muted, textAlign: "center" },
  actions: { gap: spacing.sm, paddingBottom: spacing.md },
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
