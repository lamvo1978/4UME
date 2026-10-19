import Ionicons from "@expo/vector-icons/Ionicons";
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { api, mediaUrl, WordVoice } from "../api/client";
import { colors } from "../theme";

const speechSettings = { rate: 0.9, auto: true };
/** The rate setting is tuned for the phone's voice; at this value recordings play at their own speed. */
const NORMAL_RATE = 0.9;
/** Waiting longer for a recording than this feels broken, so the phone's voice takes over. */
const RECORDING_WAIT_MS = 5000;

// iOS mutes the app's audio when the ring/silent switch is on; learners expect pronunciation anyway.
let audioMode: Promise<void> | null = null;
function ensureAudioMode() {
  audioMode ??= setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" }).catch(() => {
    audioMode = null;
  });
  return audioMode;
}

/** English voices for example sentences; novelty and online-only voices are left out. */
let sentenceVoices: string[] = [];

/**
 * The first utterance after launch comes out clipped or crackly while the audio session switches and the
 * speech engine loads, so both are prepared up front and the first word waits for them to settle.
 */
let warm: Promise<void> | null = null;
function warmUp() {
  warm ??= Promise.all([
    ensureAudioMode(),
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        sentenceVoices = voices
          .filter((v) => /^en[-_](US|GB|AU|IE|CA)$/i.test(v.language) && !/synthesis|eloquence|network/i.test(v.identifier))
          .map((v) => v.identifier);
      })
      .catch(() => undefined),
  ])
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

/** Bumped by every speak/stop so audio still waiting (warm-up, download) never plays over a newer one. */
let token = 0;
let player: AudioPlayer | null = null;

/** `remove()` alone leaves the recording playing until it's garbage collected. */
function stopAll() {
  Speech.stop();
  player?.pause();
  player?.remove();
  player = null;
}

/** Reads text with the phone's voice; `anyVoice` picks a random English voice (used for example sentences). */
export function speak(text: string, rate = speechSettings.rate, anyVoice = false) {
  stopAll();
  const t = ++token;
  void warmUp().then(() => {
    if (t !== token) return;
    const voice = anyVoice && sentenceVoices.length ? sentenceVoices[Math.floor(Math.random() * sentenceVoices.length)] : undefined;
    Speech.speak(text, { language: "en-US", rate, voice });
  });
}

const recordings = new Map<string, Promise<string | null>>();

function recordingOf(text: string, voice: WordVoice) {
  const key = `${voice}:${text.trim().toLowerCase()}`;
  let found = recordings.get(key);
  if (!found) {
    found = api
      .wordAudio(text.trim(), voice)
      .then((r) => r.url)
      .catch(() => null);
    // A failure is retried next time; quota may be back next month.
    found.then((url) => url ?? recordings.delete(key));
    recordings.set(key, found);
  }
  return found;
}

/** A vocabulary word in a natural Azure voice; falls back to the phone's voice when there is no recording. */
export function speakWord(text: string, voice: WordVoice = "female") {
  stopAll();
  const t = ++token;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), RECORDING_WAIT_MS));
  void Promise.all([Promise.race([recordingOf(text, voice), timeout]), warmUp()]).then(([url]) => {
    if (t !== token) return;
    if (!url) {
      speak(text);
      return;
    }
    // iOS otherwise deactivates the audio session when the word ends, which stops a recording started meanwhile.
    const p = createAudioPlayer({ uri: mediaUrl(url)! }, { keepAudioSessionActive: true });
    player = p;
    let started = false;
    let failed = false;
    const useOwnVoice = () => {
      if (failed || t !== token) return;
      failed = true;
      clearTimeout(fallback);
      speak(text);
    };
    const fallback = setTimeout(() => {
      if (!started) useOwnVoice();
    }, RECORDING_WAIT_MS);
    p.addListener("playbackStatusUpdate", (s) => {
      // Not in AudioStatus's type, but both platforms report a load/playback failure this way.
      if ((s as { error?: string | null }).error) {
        useOwnVoice();
        return;
      }
      if (started || failed || !s.isLoaded || t !== token) return;
      started = true;
      clearTimeout(fallback);
      p.setPlaybackRate(Math.min(1.5, Math.max(0.5, speechSettings.rate / NORMAL_RATE)));
      p.play();
    });
  });
}

/** For words that play by themselves when a screen or card opens: waits for the transition so the animation doesn't cut them. */
export function speakAfterTransition(text: string) {
  stopAll();
  const t = ++token;
  InteractionManager.runAfterInteractions(() => {
    if (t === token) speakWord(text);
  });
}

/** Speaks a word only when "Tự động phát âm" is on; use for audio the learner didn't ask for. */
export function speakAuto(text: string) {
  if (speechSettings.auto) speakAfterTransition(text);
}

export function stopSpeaking() {
  token++;
  stopAll();
}

const SIZES = { sm: 30, md: 40, lg: 88 } as const;

/** Reads a sentence (random English voice of the phone), or a word in the given Azure voice. */
export function SpeakButton({ text, size = "md", voice }: { text: string; size?: keyof typeof SIZES; voice?: WordVoice }) {
  const d = SIZES[size];
  return (
    <Pressable
      onPress={() => (voice ? speakWord(text, voice) : speak(text, speechSettings.rate, true))}
      hitSlop={10}
      accessibilityLabel={voice === "male" ? "Nghe giọng nam" : voice === "female" ? "Nghe giọng nữ" : "Nghe"}
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

/** A word's two voices side by side: female and male. */
export function WordVoices({ text, size = "md" }: { text: string; size?: "sm" | "md" | "lg" }) {
  if (size === "lg") {
    return (
      <View style={styles.bigRow}>
        <SpeakButton text={text} size="lg" voice="female" />
        <VoicePill text={text} voice="male" />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <VoicePill text={text} voice="female" small={size === "sm"} />
      <VoicePill text={text} voice="male" small={size === "sm"} />
    </View>
  );
}

function VoicePill({ text, voice, small }: { text: string; voice: WordVoice; small?: boolean }) {
  return (
    <Pressable
      onPress={() => speakWord(text, voice)}
      hitSlop={6}
      accessibilityLabel={voice === "male" ? "Nghe giọng nam" : "Nghe giọng nữ"}
      style={({ pressed }) => [styles.pill, small && styles.pillSmall, pressed && styles.pressed]}
    >
      <Ionicons name="volume-high" size={small ? 13 : 16} color={colors.accent} />
      <Text style={[styles.pillText, small && styles.pillTextSmall]}>{voice === "male" ? "Nam" : "Nữ"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  large: { backgroundColor: colors.accent },
  pressed: { opacity: 0.7 },
  row: { flexDirection: "row", gap: 6 },
  bigRow: { alignItems: "center", gap: 10 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft },
  pillSmall: { height: 28, paddingHorizontal: 8, borderRadius: 14 },
  pillText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  pillTextSmall: { fontSize: 12 },
});
