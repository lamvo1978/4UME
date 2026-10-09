import { StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

/** Shared look of the sign-in, sign-up and password reset screens. */
export const authStyles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  content: { padding: spacing.lg, justifyContent: "center", gap: spacing.sm },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink },
  brand: { color: colors.accent, fontWeight: "700", marginBottom: spacing.md },
  hint: { color: colors.muted, fontSize: 15, lineHeight: 21, marginBottom: spacing.sm },
  strong: { color: colors.ink, fontWeight: "600" },
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
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { textAlign: "center", color: colors.accent, marginTop: spacing.md },
  error: { color: "#8B3A2A" },
});
