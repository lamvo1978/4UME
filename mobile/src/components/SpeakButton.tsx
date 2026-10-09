import Ionicons from "@expo/vector-icons/Ionicons";
import { setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";
import { Pressable, StyleSheet } from "react-native";
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

/** Kept in sync with the user's settings by AuthProvider. */
export function configureSpeech(rate: number, auto: boolean) {
  speechSettings.rate = rate;
  speechSettings.auto = auto;
}

export function speak(text: string, rate = speechSettings.rate) {
  Speech.stop();
  void ensureAudioMode().then(() => Speech.speak(text, { language: "en-US", rate }));
}

/** Speaks only when "Tự động phát âm" is on; use for audio the learner didn't ask for. */
export function speakAuto(text: string) {
  if (speechSettings.auto) speak(text);
}

export function stopSpeaking() {
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
