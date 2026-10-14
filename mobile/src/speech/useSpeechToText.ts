import { requireOptionalNativeModule } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

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

/**
 * English speech to text with the phone's own recognizer (Apple / Google), free and unlimited.
 * `onFinal` gets the full transcript once the learner stops (or the recognizer decides they finished).
 */
export function useSpeechToText(onFinal?: (text: string) => void, contextualStrings?: string[]) {
  const id = useRef(0);
  if (!id.current) id.current = nextId++;
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const latest = useRef("");
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => {
    if (!lib) return;
    const m = lib.ExpoSpeechRecognitionModule;
    const mine = () => owner === id.current;
    const subs = [
      m.addListener("result", (e) => {
        if (!mine()) return;
        const t = e.results[0]?.transcript?.trim() ?? "";
        latest.current = t;
        setText(t);
      }),
      m.addListener("error", (e) => {
        if (!mine()) return;
        if (e.error !== "aborted") setError(ERRORS[e.error] ?? "Chưa nhận dạng được, bạn thử lại nhé.");
      }),
      m.addListener("end", () => {
        if (!mine()) return;
        owner = 0;
        setListening(false);
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(() => {});
        if (latest.current) finalRef.current?.(latest.current);
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      if (mine()) {
        owner = 0;
        m.abort();
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (!lib) return;
    const m = lib.ExpoSpeechRecognitionModule;
    setError("");
    setText("");
    latest.current = "";
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
      continuous: false,
      addsPunctuation: false,
      contextualStrings: contextualStrings?.length ? contextualStrings : undefined,
    });
  }, [contextualStrings]);

  const stop = useCallback(() => {
    if (lib && owner === id.current) lib.ExpoSpeechRecognitionModule.stop();
  }, []);

  return { available: speechToTextAvailable, listening, text, error, start, stop };
}
