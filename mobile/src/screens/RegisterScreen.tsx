import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { authStyles as styles } from "../components/authStyles";
import { CODE_LENGTH, CodeInput } from "../components/CodeInput";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Set once the code is mailed; switches the screen to the code step. */
  const [sent, setSent] = useState<{ seconds: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function sendCode() {
    setError("");
    if (password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.sendRegisterCode(email.trim());
      setCode("");
      setSent({ seconds: result.resendAfterSeconds });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được mã");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setResending(true);
    try {
      const result = await api.sendRegisterCode(email.trim());
      setSent({ seconds: result.resendAfterSeconds });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được mã");
    } finally {
      setResending(false);
    }
  }

  async function onSubmit() {
    setError("");
    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim() || "Bạn", code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <KeyboardScreen style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nhập mã xác nhận</Text>
        <Text style={styles.brand}>4UME</Text>
        <Text style={styles.hint}>
          Mã 6 số đã được gửi tới <Text style={styles.strong}>{email.trim()}</Text>. Nếu không thấy, hãy xem cả mục Spam
          hoặc Quảng cáo.
        </Text>
        <CodeInput value={code} onChangeText={setCode} resendAfter={sent} onResend={resend} resending={resending} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.primary, code.length < CODE_LENGTH && styles.primaryDisabled]}
          onPress={onSubmit}
          disabled={loading || code.length < CODE_LENGTH}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Tạo tài khoản</Text>}
        </Pressable>
        <Pressable
          onPress={() => {
            setSent(null);
            setError("");
          }}
        >
          <Text style={styles.link}>Đổi email</Text>
        </Pressable>
      </KeyboardScreen>
    );
  }

  return (
    <KeyboardScreen style={styles.root} contentContainerStyle={styles.content}>
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
        autoComplete="email"
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Mật khẩu (tối thiểu 6 ký tự)"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={sendCode} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Gửi mã xác nhận</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
      </Pressable>
    </KeyboardScreen>
  );
}
