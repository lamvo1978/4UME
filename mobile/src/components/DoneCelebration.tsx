import { useEffect, useState } from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, useWindowDimensions } from "react-native";
import { CelebrationVideo } from "../celebration/CelebrationVideo";
import { celebrationWidth } from "../celebration/sources";
import { colors } from "../theme";

/** End-of-session hero: Grok `celebration-done.mp4`. */
export function DoneCelebration() {
  const { width: windowWidth } = useWindowDimensions();
  const sceneWidth = celebrationWidth(windowWidth);
  const [replayKey, setReplayKey] = useState(0);

  return (
    <View style={styles.column}>
      <CelebrationVideo width={sceneWidth} replayKey={replayKey} wrapBackground="transparent" />
      {__DEV__ ? (
        <Text style={styles.replayHint} onPress={() => setReplayKey((k) => k + 1)}>
          Chạy lại animation
        </Text>
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
  replayHint: { marginTop: 8, fontSize: 13, fontWeight: "600", color: colors.muted },
});
