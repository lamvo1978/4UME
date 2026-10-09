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

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation, route }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<{ seconds: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function sendCode(again = false) {
    setError("");
    if (again) setResending(true);
    else setLoading(true);
    try {
      const result = await api.sendResetCode(email.trim());
      if (!again) setCode("");
      setSent({ seconds: result.resendAfterSeconds });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được mã");
    } finally {
      setLoading(false);
      setResending(false);
    }
  }

  async function onSubmit() {
    setError("");
    if (password.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim(), code, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đặt lại được mật khẩu");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    const ready = code.length === CODE_LENGTH && password.length > 0;
    return (
      <KeyboardScreen style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Đặt mật khẩu mới</Text>
        <Text style={styles.brand}>4UME</Text>
        <Text style={styles.hint}>
          Mã 6 số đã được gửi tới <Text style={styles.strong}>{email.trim()}</Text>. Nếu không thấy, hãy xem cả mục Spam
          hoặc Quảng cáo.
        </Text>
        <CodeInput value={code} onChangeText={setCode} resendAfter={sent} onResend={() => sendCode(true)} resending={resending} />
        <TextInput
          style={styles.input}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.primary, !ready && styles.primaryDisabled]} onPress={onSubmit} disabled={loading || !ready}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Đặt lại và đăng nhập</Text>}
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
      <Text style={styles.title}>Quên mật khẩu</Text>
      <Text style={styles.brand}>4UME</Text>
      <Text style={styles.hint}>Nhập email bạn đã dùng để tạo tài khoản, chúng tôi sẽ gửi mã để đặt mật khẩu mới.</Text>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={() => sendCode()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Gửi mã</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Quay lại đăng nhập</Text>
      </Pressable>
    </KeyboardScreen>
  );
}
