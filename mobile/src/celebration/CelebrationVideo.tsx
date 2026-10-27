import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { CELEBRATION_DONE, CELEBRATION_WIDTH_OVER_HEIGHT } from "./sources";

export type CelebrationVideoProps = {
  source?: number;
  width: number;
  replayKey?: number;
  rounded?: boolean;
  haptics?: boolean;
  /** Letterbox behind the clip; default matches app screen (`colors.bg`). */
  wrapBackground?: string;
  contentFit?: "cover" | "contain";
};

export function CelebrationVideo({
  source = CELEBRATION_DONE,
  width,
  replayKey = 0,
  rounded = false,
  haptics = true,
  wrapBackground = colors.bg,
  contentFit = "contain",
}: CelebrationVideoProps) {
  const height = width / CELEBRATION_WIDTH_OVER_HEIGHT;

  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (haptics && !reduce) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
        player.currentTime = 0;
        if (reduce) player.pause();
        else player.play();
      });
    return () => {
      cancelled = true;
    };
  }, [replayKey, player, haptics]);

  return (
    <View
      style={[
        styles.wrap,
        { width, height, backgroundColor: wrapBackground },
        rounded && styles.rounded,
      ]}
    >
      <VideoView style={styles.video} player={player} contentFit={contentFit} nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    overflow: "hidden",
  },
  rounded: { borderRadius: 24 },
  video: { width: "100%", height: "100%" },
});
