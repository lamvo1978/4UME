import Ionicons from "@expo/vector-icons/Ionicons";
import { setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";
import { InteractionManager, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";

const speechSettings = { rate: 0.9, auto: true };

// iOS mutes the app's audio when the ring/silent switch is on; learners expect pronunciation anyway.
let audioMode: Promise<void> | null = null;
function ensureAudioMode() {
  audioMode ??= setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(() => {
    audioMode = null;
  });
  return audioMode;
}

/**
 * The first utterance after launch comes out clipped or crackly while the audio session switches and the
 * speech engine loads, so both are prepared up front and the first word waits for them to settle.
 */
let warm: Promise<void> | null = null;
function warmUp() {
  warm ??= Promise.all([ensureAudioMode(), Speech.getAvailableVoicesAsync().catch(() => [])])
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, 150)))
    .catch(() => {
      warm = null;
    });
  return warm;
}

/** Kept in sync with the user's settings by AuthProvider; also warms up the speech engine. */
export function configureSpeech(rate: number, auto: boolean) {
  speechSettings.rate = rate;
  speechSettings.auto = auto;
  void warmUp();
}

export function speechRate() {
  return speechSettings.rate;
}

/** Bumped by every speak/stop so a word still waiting for warm-up never plays over a newer one. */
let token = 0;

export function speak(text: string, rate = speechSettings.rate) {
  Speech.stop();
  const t = ++token;
  void warmUp().then(() => {
    if (t === token) Speech.speak(text, { language: "en-US", rate });
  });
}

/** For words that play by themselves when a screen or card opens: waits for the transition so the animation doesn't cut them. */
export function speakAfterTransition(text: string) {
  Speech.stop();
  const t = ++token;
  InteractionManager.runAfterInteractions(() => {
    if (t === token) speak(text);
  });
}

/** Speaks only when "Tự động phát âm" is on; use for audio the learner didn't ask for. */
export function speakAuto(text: string) {
  if (speechSettings.auto) speakAfterTransition(text);
}

export function stopSpeaking() {
  token++;
  Speech.stop();
}

const SIZES = { sm: 30, md: 40, lg: 88 } as const;

export function SpeakButton({ text, size = "md" }: { text: string; size?: keyof typeof SIZES }) {
  const d = SIZES[size];
  return (
    <Pressable
      onPress={() => speak(text)}
      hitSlop={10}
      style={({ pressed }) => [
        styles.button,
        { width: d, height: d, borderRadius: d / 2 },
        size === "lg" && styles.large,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="volume-high" size={d * 0.45} color={size === "lg" ? colors.white : colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  large: { backgroundColor: colors.accent },
  pressed: { opacity: 0.7 },
});
