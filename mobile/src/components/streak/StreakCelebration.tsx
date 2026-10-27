import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { api, Streak } from "../../api/client";
import { CelebrationVideo } from "../../celebration/CelebrationVideo";
import { CELEBRATION_STREAK, celebrationWidth } from "../../celebration/sources";
import { colors, shadow, spacing } from "../../theme";
import { FREEZE_EVERY, milestoneLine } from "./streakCopy";
import { WeekStrip } from "./WeekStrip";

/** Full-screen "+1 day" moment shown after the first study activity of the day. */
export function StreakCelebration({ streak, onClose }: { streak: number; onClose: () => void }) {
  const [details, setDetails] = useState<Streak | null>(null);
  const [shown, setShown] = useState(Math.max(streak - 1, 0));
  const { width: windowWidth } = useWindowDimensions();
  const videoWidth = celebrationWidth(windowWidth, spacing.lg * 4);

  useEffect(() => {
    api.stats().then((s) => setDetails(s.streak)).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const tick = setTimeout(() => setShown(streak), 450);
    return () => clearTimeout(tick);
  }, [streak]);

  const every = details?.freezeEvery ?? FREEZE_EVERY;
  const earnedFreeze = !!details?.freezeOnStreak && streak > 0 && every > 0 && streak % every === 0;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <CelebrationVideo
            source={CELEBRATION_STREAK}
            width={videoWidth}
            replayKey={streak}
            haptics={false}
            wrapBackground="transparent"
          />

          <Text style={styles.count}>{shown}</Text>
          <Text style={styles.title}>{streak === 1 ? "ngày học đầu tiên!" : "ngày học liên tiếp!"}</Text>
          <Text style={styles.sub}>{milestoneLine(streak, details?.nextMilestone ?? null)}</Text>

          {details ? (
            <View style={styles.week}>
              <WeekStrip today={details.today} days={details.days} size={34} />
            </View>
          ) : null}

          {earnedFreeze ? (
            <View style={styles.freeze}>
              <View style={styles.freezeIcon}>
                <Ionicons name="snow" size={20} color={colors.white} />
              </View>
              <Text style={styles.freezeText}>
                Thưởng 1 lượt đóng băng! Lỡ quên một ngày, chuỗi của bạn vẫn được giữ.
              </Text>
            </View>
          ) : null}

          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.buttonText}>Tiếp tục</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,46,40,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.lg,
    paddingTop: spacing.md,
    ...shadow.card,
  },
  count: { marginTop: spacing.sm, fontSize: 64, fontWeight: "800", color: colors.flameDeep, lineHeight: 70 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 6, fontSize: 15, color: colors.muted, textAlign: "center" },
  week: { alignSelf: "stretch", marginTop: spacing.lg },
  freeze: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.iceSoft,
    alignSelf: "stretch",
  },
  freezeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ice,
    alignItems: "center",
    justifyContent: "center",
  },
  freezeEmoji: { fontSize: 18 },
  freezeText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink, lineHeight: 18 },
  button: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: colors.flame,
  },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "800" },
  pressed: { opacity: 0.8 },
});
