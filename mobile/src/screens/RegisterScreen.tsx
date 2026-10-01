import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim() || "Bạn");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Tạo tài khoản</Text>
      <Text style={styles.brand}>4UME</Text>
      <TextInput
        style={styles.input}
        placeholder="Tên hiển thị"
        placeholderTextColor={colors.muted}
        value={displayName}
        onChangeText={setDisplayName}
      />
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
        placeholder="Mật khẩu (tối thiểu 6 ký tự)"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Tạo tài khoản</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center", gap: spacing.sm },
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
