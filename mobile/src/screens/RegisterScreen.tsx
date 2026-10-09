import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { authStyles as styles } from "../components/authStyles";
import { CODE_LENGTH, CodeInput } from "../components/CodeInput";
import { AuthHeader, AuthInput } from "../components/AuthField";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { RootStackParamList } from "../navigation/types";

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
        <AuthHeader title="Nhập mã xác nhận" />
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
      <AuthHeader title="Tạo tài khoản" subtitle="Vài giây thôi là bắt đầu học được rồi" />
      <AuthInput
        icon="person-outline"
        placeholder="Tên hiển thị"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <AuthInput
        icon="mail-outline"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <AuthInput
        icon="lock-closed-outline"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Mật khẩu (tối thiểu 6 ký tự)"
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
