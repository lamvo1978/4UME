import { requireOptionalNativeModule } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

type Lib = typeof import("expo-speech-recognition");

/** The native module only exists in real builds; Expo Go has none, so the feature hides itself there. */
const lib: Lib | null = requireOptionalNativeModule("ExpoSpeechRecognition") ? require("expo-speech-recognition") : null;

export const speechToTextAvailable = !!lib;

/** The recognizer is one per device: only the hook that started it reacts to its events. */
let owner = 0;
let nextId = 1;

const ERRORS: Record<string, string> = {
  "not-allowed": "Bạn chưa cho phép micro hoặc nhận dạng giọng nói. Mở Cài đặt của máy → 4UME để bật nhé.",
  "service-not-allowed": "Máy chưa bật nhận dạng giọng nói (Siri & Đọc chính tả / Google).",
  "language-not-supported": "Máy chưa hỗ trợ nhận dạng tiếng Anh.",
  network: "Cần kết nối mạng để nhận dạng giọng nói.",
  "no-speech": "Mình chưa nghe thấy gì, bạn nói to hơn nhé.",
  "speech-timeout": "Mình chưa nghe thấy gì, bạn nói to hơn nhé.",
  busy: "Micro đang bận, bạn thử lại nhé.",
};

export type SpeechOptions = {
  /**
   * Keep listening through pauses (a learner thinking mid-sentence) until `stop()`, a silence of `silenceMs`,
   * or `maxMs`. Without it the recognizer ends at the first pause.
   */
  continuous?: boolean;
  silenceMs?: number;
  maxMs?: number;
};

const DEFAULT_SILENCE_MS = 5000;
const DEFAULT_MAX_MS = 60_000;

const join = (a: string, b: string) => [a, b].filter(Boolean).join(" ");

/**
 * English speech to text with the phone's own recognizer (Apple / Google), free and unlimited.
 * `onFinal` gets the full transcript once the learner stops (or the recognizer decides they finished).
 */
export function useSpeechToText(onFinal?: (text: string) => void, contextualStrings?: string[], options?: SpeechOptions) {
  const id = useRef(0);
  if (!id.current) id.current = nextId++;
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const latest = useRef("");
  /** Continuous mode: finished segments so far; each final result is a new utterance to append. */
  const committed = useRef("");
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const continuous = !!options?.continuous;
  const silenceMs = options?.silenceMs ?? DEFAULT_SILENCE_MS;
  const maxMs = options?.maxMs ?? DEFAULT_MAX_MS;
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    silenceTimer.current = null;
    maxTimer.current = null;
  }, []);

  useEffect(() => {
    if (!lib) return;
    const m = lib.ExpoSpeechRecognitionModule;
    const mine = () => owner === id.current;
    const subs = [
      m.addListener("result", (e) => {
        if (!mine()) return;
        const t = e.results[0]?.transcript?.trim() ?? "";
        if (continuous) {
          const full = join(committed.current, t);
          if (e.isFinal) committed.current = full;
          latest.current = full;
          setText(full);
          if (silenceTimer.current) clearTimeout(silenceTimer.current);
          silenceTimer.current = setTimeout(() => {
            if (mine()) m.stop();
          }, silenceMs);
        } else {
          latest.current = t;
          setText(t);
        }
      }),
      m.addListener("error", (e) => {
        if (!mine()) return;
        if (e.error !== "aborted") setError(ERRORS[e.error] ?? "Chưa nhận dạng được, bạn thử lại nhé.");
      }),
      m.addListener("end", () => {
        if (!mine()) return;
        owner = 0;
        clearTimers();
        setListening(false);
        // The recognizer leaves iOS in playAndRecord + "measurement" mode, which plays everything much quieter until the app restarts.
        if (Platform.OS === "ios") {
          try {
            m.setCategoryIOS({ category: "playback", categoryOptions: ["duckOthers"], mode: "default" });
          } catch {}
        }
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(() => {});
        if (latest.current) finalRef.current?.(latest.current);
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      clearTimers();
      if (mine()) {
        owner = 0;
        m.abort();
      }
    };
  }, [continuous, silenceMs, clearTimers]);

  const start = useCallback(async () => {
    if (!lib) return;
    const m = lib.ExpoSpeechRecognitionModule;
    setError("");
    setText("");
    latest.current = "";
    committed.current = "";
    const permission = await m.requestPermissionsAsync();
    if (!permission.granted) {
      setError(ERRORS["not-allowed"]);
      return;
    }
    if (owner) m.abort();
    owner = id.current;
    setListening(true);
    m.start({
      lang: "en-US",
      interimResults: true,
      continuous,
      addsPunctuation: false,
      contextualStrings: contextualStrings?.length ? contextualStrings : undefined,
      // Android 12 and below has no continuous mode; a longer end-of-speech silence is the closest there.
      androidIntentOptions: continuous
        ? { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: silenceMs, EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: silenceMs }
        : undefined,
    });
    if (continuous) {
      const me = id.current;
      maxTimer.current = setTimeout(() => {
        if (owner === me) m.stop();
      }, maxMs);
    }
  }, [contextualStrings, continuous, silenceMs, maxMs]);

  const stop = useCallback(() => {
    if (lib && owner === id.current) lib.ExpoSpeechRecognitionModule.stop();
  }, []);

  return { available: speechToTextAvailable, listening, text, error, start, stop };
}
