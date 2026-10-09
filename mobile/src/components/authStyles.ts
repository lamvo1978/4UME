import { StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

/** Shared look of the sign-in, sign-up and password reset screens. */
export const authStyles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, justifyContent: "center", gap: 12 },
  hint: { color: colors.muted, fontSize: 15, lineHeight: 21, marginBottom: spacing.sm, textAlign: "center" },
  strong: { color: colors.ink, fontWeight: "600" },
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
