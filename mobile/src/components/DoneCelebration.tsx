import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from "react-native";
import { colors } from "../theme";

const PIECES = 28;
const PALETTE = [colors.flame, colors.gold, colors.accent, colors.flameDeep, "#7BC8B4"];

type Piece = { dx: number; peak: number; fall: number; turns: number; color: string; w: number; h: number; delay: number };

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => {
    // Upward cone, a bit wider than straight up so the burst fills the screen width.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const power = 120 + Math.random() * 110;
    return {
      dx: Math.cos(angle) * power * 1.3,
      peak: Math.sin(angle) * power,
      fall: 140 + Math.random() * 140,
      turns: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2),
      color: PALETTE[i % PALETTE.length],
      w: 6 + Math.random() * 5,
      h: 10 + Math.random() * 6,
      delay: Math.random() * 120,
    };
  });
}

/** End-of-session hero: the 4UME horse leaps in and hops forward while confetti bursts behind it. */
export function DoneCelebration({ size = 112 }: { size?: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(makePieces, []);
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
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        Animated.parallel([
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
  }, [pop, hop, burst]);

  return (
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
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", backgroundColor: colors.accentSoft, opacity: 0.55 },
  piece: { position: "absolute", borderRadius: 2 },
});
