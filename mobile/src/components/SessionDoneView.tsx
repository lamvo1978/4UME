import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { CelebrationVideo } from "../celebration/CelebrationVideo";
import { CELEBRATION_DONE, celebrationWidth } from "../celebration/sources";
import { CountUp } from "./DoneCelebration";
import { colors, shadow, spacing } from "../theme";

export type SessionDoneStat = { value: number; label: string };

export type SessionDoneViewProps = {
  title: string;
  subtitle: string;
  stats: SessionDoneStat[];
  notes?: string[];
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  videoSource?: number;
  replayKey?: number;
  videoBackground?: string;
  videoContentFit?: "cover" | "contain";
  footer?: ReactNode;
};

/** Shared “session complete” layout (review, grammar, dev preview). */
export function SessionDoneView({
  title,
  subtitle,
  stats,
  notes = [],
  primaryLabel,
  secondaryLabel = "Xong",
  onPrimary,
  onSecondary,
  videoSource = CELEBRATION_DONE,
  replayKey = 0,
  videoBackground,
  videoContentFit = "contain",
  footer,
}: SessionDoneViewProps) {
  const { width: windowWidth } = useWindowDimensions();
  const sceneWidth = celebrationWidth(windowWidth);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <CelebrationVideo
        source={videoSource}
        width={sceneWidth}
        replayKey={replayKey}
        wrapBackground={videoBackground}
        contentFit={videoContentFit}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
      <View style={styles.summaryRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <CountUp value={s.value} style={styles.statValue} />
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      {notes.map((line) => (
        <Text key={line} style={styles.sub}>
          {line}
        </Text>
      ))}
      {footer}
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onPrimary}>
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </Pressable>
        {onSecondary ? (
          <Pressable style={styles.secondaryBtn} onPress={onSecondary}>
            <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { marginTop: spacing.lg, fontSize: 24, fontWeight: "700", color: colors.ink, textAlign: "center" },
  sub: { marginTop: spacing.sm, color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  summaryRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignSelf: "stretch" },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  statValue: { fontSize: 28, fontWeight: "700", color: colors.accent },
  statLabel: { marginTop: 2, color: colors.muted, fontWeight: "600" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
});
