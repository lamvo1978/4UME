import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, fonts, spacing } from "../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Emblem, title and one line of context at the top of the sign-in, sign-up and reset screens. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Image source={require("../../assets/logo-emblem.png")} style={styles.emblem} resizeMode="contain" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Text field with a leading icon; password fields get a show/hide toggle. */
export function AuthInput({ icon, secureTextEntry, style, ...props }: TextInputProps & { icon: IconName }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <Ionicons name={icon} size={20} color={focused ? colors.accent : colors.muted} />
      <TextInput
        {...props}
        style={[styles.input, style]}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry && hidden}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
      {secureTextEntry ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
          <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: spacing.lg },
  emblem: { width: 64, height: 100, marginBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: "700", color: colors.ink, textAlign: "center" },
  subtitle: { marginTop: spacing.xs, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  fieldFocused: { borderColor: colors.accent },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: colors.ink },
});
