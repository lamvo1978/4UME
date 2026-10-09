import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { api, Streak } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";
import { FREEZE_EVERY, milestoneLine } from "./streakCopy";
import { WeekStrip } from "./WeekStrip";

const SPARKS = 12;

/** Full-screen "+1 day" moment shown after the first study activity of the day. */
export function StreakCelebration({ streak, onClose }: { streak: number; onClose: () => void }) {
  const [details, setDetails] = useState<Streak | null>(null);
  const [shown, setShown] = useState(Math.max(streak - 1, 0));
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api.stats().then((s) => setDetails(s.streak)).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    const tick = setTimeout(() => setShown(streak), 450);
    return () => {
      loop.stop();
      clearTimeout(tick);
    };
  }, [streak, pop, burst, glow]);

  const flameScale = Animated.multiply(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
    glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })
  );
  const earnedFreeze = streak > 0 && streak % FREEZE_EVERY === 0;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.flameWrap}>
            {Array.from({ length: SPARKS }, (_, i) => {
              const angle = (i / SPARKS) * Math.PI * 2;
              const distance = 78 + (i % 3) * 14;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.spark,
                    i % 2 === 0 && styles.sparkGold,
                    {
                      opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] }) },
                        { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] }) },
                      ],
                    },
                  ]}
                />
              );
            })}
            <Animated.View style={[styles.halo, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }) }]} />
            <Animated.View style={{ transform: [{ scale: flameScale }] }}>
              <Ionicons name="flame" size={120} color={colors.flame} />
            </Animated.View>
          </View>

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
    paddingTop: spacing.xl,
    ...shadow.card,
  },
  flameWrap: { width: 180, height: 160, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: colors.flameSoft },
  spark: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: colors.flame },
  sparkGold: { backgroundColor: colors.gold, width: 8, height: 8, borderRadius: 4 },
  count: { fontSize: 64, fontWeight: "800", color: colors.flameDeep, lineHeight: 70 },
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
