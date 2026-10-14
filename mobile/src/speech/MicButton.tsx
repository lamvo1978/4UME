import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { useSpeechToText } from "./useSpeechToText";

/** Mic next to a text box: speak instead of typing. Renders nothing where speech recognition is unavailable (Expo Go). */
export function MicButton({ onText, size = 40, disabled }: { onText: (text: string) => void; size?: number; disabled?: boolean }) {
  const speech = useSpeechToText(onText);

  useEffect(() => {
    if (speech.error) Alert.alert("Nói thành chữ", speech.error);
  }, [speech.error]);

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
