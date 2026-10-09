import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardScreen style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Đăng nhập</Text>
      <Text style={styles.brand}>4UME</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Mật khẩu"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Đăng nhập</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>Chưa có tài khoản? Tạo mới</Text>
      </Pressable>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  content: { padding: spacing.lg, justifyContent: "center", gap: spacing.sm },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink },
  brand: { color: colors.accent, fontWeight: "700", marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
  },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { textAlign: "center", color: colors.accent, marginTop: spacing.md },
  error: { color: "#8B3A2A" },
});
