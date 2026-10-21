import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { SpeechOptions, useSpeechToText } from "./useSpeechToText";

type Props = {
  onText: (text: string) => void;
  /** Text heard so far while the learner is still speaking. */
  onPartial?: (text: string) => void;
  onListening?: (listening: boolean) => void;
  size?: number;
  disabled?: boolean;
  /** See {@link SpeechOptions.continuous}: for longer answers where the learner pauses to think. */
  continuous?: boolean;
};

const CONTINUOUS: SpeechOptions = { continuous: true };

/** Mic next to a text box: speak instead of typing. Renders nothing where speech recognition is unavailable (Expo Go). */
export function MicButton({ onText, onPartial, onListening, size = 40, disabled, continuous }: Props) {
  const speech = useSpeechToText(onText, undefined, continuous ? CONTINUOUS : undefined);

  useEffect(() => {
    if (speech.error) Alert.alert("Nói thành chữ", speech.error);
  }, [speech.error]);

  useEffect(() => {
    if (speech.listening && speech.text) onPartial?.(speech.text);
  }, [speech.listening, speech.text, onPartial]);

  useEffect(() => {
    onListening?.(speech.listening);
  }, [speech.listening, onListening]);

  if (!speech.available) return null;
  return (
    <Pressable
      onPress={() => (speech.listening ? speech.stop() : void speech.start())}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={speech.listening ? "Dừng nghe" : "Nói thay vì gõ"}
      style={({ pressed }) => [
        styles.mic,
        { width: size, height: size, borderRadius: size / 2 },
        speech.listening && styles.listening,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Ionicons name={speech.listening ? "stop" : "mic"} size={size * 0.5} color={speech.listening ? colors.white : colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft },
  listening: { backgroundColor: colors.danger },
  dim: { opacity: 0.6 },
});
