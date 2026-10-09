import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { authStyles as styles } from "../components/authStyles";
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
        autoComplete="email"
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="current-password"
        placeholder="Mật khẩu"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        style={local.forgot}
        hitSlop={8}
        onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() || undefined })}
      >
        <Text style={local.forgotText}>Quên mật khẩu?</Text>
      </Pressable>
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

const local = StyleSheet.create({
  forgot: { alignSelf: "flex-end", paddingVertical: spacing.xs },
  forgotText: { color: colors.accent, fontWeight: "600" },
});
