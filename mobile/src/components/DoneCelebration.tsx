import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import { colors } from "../theme";

const PIECES = 24;
const PIECES_PERFECT = 44;
const PALETTE = [colors.flame, colors.gold, colors.accent, colors.flameDeep, "#7BC8B4"];

type Piece = { dx: number; peak: number; fall: number; turns: number; color: string; w: number; h: number; delay: number };

function makePieces(count: number, power: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    // Upward cone, a bit wider than straight up so the burst fills the screen width.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const strength = power * (0.6 + Math.random() * 0.5);
    return {
      dx: Math.cos(angle) * strength * 1.3,
      peak: Math.sin(angle) * strength,
      fall: 140 + Math.random() * 140,
      turns: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2),
      color: PALETTE[i % PALETTE.length],
      w: 6 + Math.random() * 5,
      h: 10 + Math.random() * 6,
      delay: Math.random() * 120,
    };
  });
}

/**
 * End-of-session hero: the 4UME horse leaps in and hops forward while confetti bursts behind it.
 * A session without mistakes gets a bigger burst and a "Hoàn hảo!" badge.
 */
export function DoneCelebration({ size = 112, perfect = false }: { size?: number; perfect?: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(() => (perfect ? makePieces(PIECES_PERFECT, 240) : makePieces(PIECES, 170)), [perfect]);
  const [still, setStill] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          setStill(true);
          pop.setValue(1);
          badge.setValue(1);
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        Animated.parallel([
          Animated.sequence([
            Animated.delay(350),
            Animated.spring(badge, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
          ]),
          Animated.spring(pop, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 1, duration: 1700, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(450),
            Animated.loop(
              Animated.sequence([
                Animated.timing(hop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver: true }),
              ]),
              { iterations: 3 },
            ),
          ]),
        ]).start();
      });
    return () => {
      cancelled = true;
    };
  }, [pop, hop, burst, badge]);

  return (
    <View style={styles.column}>
    <View style={[styles.wrap, { width: size * 1.6, height: size * 1.4 }]}>
      {still
        ? null
        : pieces.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                styles.piece,
                {
                  width: p.w,
                  height: p.h,
                  backgroundColor: p.color,
                  opacity: burst.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                    {
                      // Rises fast, slows at the top, then falls past the start: a rough throw arc.
                      translateY: burst.interpolate({
                        inputRange: [0, 0.3, 0.45, 1],
                        outputRange: [0, p.peak * 0.85, p.peak, p.peak + p.fall + Math.abs(p.peak)],
                      }),
                    },
                    {
                      rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.turns * 360}deg`] }),
                    },
                  ],
                },
              ]}
            />
          ))}
      <View style={[styles.halo, { width: size * 1.15, height: size * 1.15, borderRadius: size }]} />
      <Animated.View
        style={{
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
            { translateX: hop.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) },
            { rotate: hop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-7deg"] }) },
          ],
        }}
      >
        <Image source={require("../../assets/logo-emblem.png")} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    </View>
      {perfect ? (
        <Animated.View style={[styles.badge, { opacity: badge, transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
          <Ionicons name="star" size={16} color={colors.gold} />
          <Text style={styles.badgeText}>Hoàn hảo! Không sai câu nào</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Counts from 0 up to `value` shortly after the done screen appears. */
export function CountUp({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value <= 0) return setShown(value);
    let frame = 0;
    const startAt = Date.now() + 400;
    const duration = Math.min(900, 250 + value * 80);
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - startAt) / duration));
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Text style={style}>{shown}</Text>;
}

const styles = StyleSheet.create({
  column: { alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.flameSoft,
  },
  badgeText: { fontSize: 14, fontWeight: "800", color: colors.flameDeep },
  wrap: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", backgroundColor: colors.accentSoft, opacity: 0.55 },
  piece: { position: "absolute", borderRadius: 2 },
});
