import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { colors, spacing } from "../../theme";

/** Bottom sheet with a title, inputs and a submit button; shows the error thrown by onSubmit. */
export function FormSheet({
  visible,
  title,
  description,
  submitLabel,
  danger,
  canSubmit = true,
  onSubmit,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  danger?: boolean;
  canSubmit?: boolean;
  onSubmit: () => Promise<void>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setError("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <View style={styles.fields}>{children}</View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]} onPress={close}>
              <Text style={styles.cancelText}>Huỷ</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                danger ? styles.dangerBtn : styles.primary,
                (!canSubmit || busy) && styles.disabled,
                pressed && styles.pressed,
              ]}
              disabled={!canSubmit || busy}
              onPress={submit}
            >
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{submitLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetInput(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(26,46,40,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  description: { marginTop: 6, fontSize: 14, color: colors.muted, lineHeight: 20 },
  fields: { marginTop: spacing.md, gap: spacing.md },
  inputWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: { marginTop: spacing.sm, color: colors.danger, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  button: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cancel: { backgroundColor: colors.bgAlt },
  cancelText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  primary: { backgroundColor: colors.accent },
  dangerBtn: { backgroundColor: colors.danger },
  primaryText: { fontSize: 16, fontWeight: "700", color: colors.white },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
