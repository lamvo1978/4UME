import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing } from "../theme";

type Props = {
  value: string;
  onChangeText: (code: string) => void;
  /** Seconds before "Gửi lại mã" is allowed; a new value restarts the countdown. */
  resendAfter: { seconds: number };
  onResend: () => void;
  resending: boolean;
};

export const CODE_LENGTH = 6;

/** The 6-digit code from the email, with a resend link once the cooldown is over. */
export function CodeInput({ value, onChangeText, resendAfter, onResend, resending }: Props) {
  const [left, setLeft] = useState(resendAfter.seconds);

  useEffect(() => {
    setLeft(resendAfter.seconds);
    const timer = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendAfter]);

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.code}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder="••••••"
        placeholderTextColor={colors.muted}
        autoFocus
      />
      <Pressable onPress={onResend} disabled={left > 0 || resending} hitSlop={8}>
        <Text style={[styles.resend, (left > 0 || resending) && styles.resendWaiting]}>
          {resending ? "Đang gửi lại mã…" : left > 0 ? `Gửi lại mã sau ${left} giây` : "Không nhận được? Gửi lại mã"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  code: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
    fontWeight: "700",
    color: colors.ink,
  },
  resend: { textAlign: "center", color: colors.accent, fontWeight: "600" },
  resendWaiting: { color: colors.muted, fontWeight: "400" },
});
