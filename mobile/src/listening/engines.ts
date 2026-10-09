import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListeningLine, mediaUrl } from "../api/client";
import { speechRate } from "../components/SpeakButton";

/** Lessons count as listened once this share has been played. */
const COMPLETE_AT = 0.9;
/** Gap after a repeated line before it plays again. */
const REPEAT_GAP_MS = 600;

export type Engine = {
  kind: "audio" | "speech";
  loading: boolean;
  playing: boolean;
  /** Index of the line being read, or -1 before the first one. */
  active: number;
  positionMs: number;
  durationMs: number;
  toggle: () => void;
  pause: () => void;
  playLine: (index: number) => void;
};

type Options = {
  lines: ListeningLine[];
  speakers: string[];
  rate: number;
  repeat: boolean;
  title: string;
  artist: string;
  initialMs: number;
  onComplete: () => void;
  onPause: (positionMs: number) => void;
};

/** Plays the generated recording; lines are highlighted from the timings saved with it. */
export function useAudioEngine(url: string, opts: Options): Engine {
  const player = useAudioPlayer({ uri: mediaUrl(url)! }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const { lines, rate, repeat } = opts;
  const latest = useRef(opts);
  latest.current = opts;
  const completed = useRef(false);
  const resumed = useRef(false);
  const lockScreen = useRef(false);
  const loop = useRef(-1);

  const positionMs = status.currentTime * 1000;
  const durationMs = status.duration * 1000;
  const active = useMemo(() => {
    let found = -1;
    lines.forEach((l, i) => {
      if (l.startMs != null && positionMs + 60 >= l.startMs) found = i;
    });
    return found;
  }, [lines, positionMs]);

  // Background playback and lock-screen controls need exclusive audio focus; restore the shared mode on leave.
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" }).catch(() => {});
    return () => {
      void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: "duckOthers" }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        player.clearLockScreenControls();
      } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!status.isLoaded || resumed.current) return;
    resumed.current = true;
    const start = latest.current.initialMs;
    if (start > 3000 && (!status.duration || start < status.duration * 1000 - 5000)) void player.seekTo(start / 1000);
  }, [status.isLoaded, status.duration, player]);

  useEffect(() => {
    if (status.isLoaded) player.setPlaybackRate(rate);
  }, [rate, status.isLoaded, player]);

  useEffect(() => {
    if (!status.playing || lockScreen.current) return;
    lockScreen.current = true;
    try {
      player.setActiveForLockScreen(true, { title: latest.current.title, artist: latest.current.artist });
    } catch {}
  }, [status.playing, player]);

  useEffect(() => {
    loop.current = repeat ? Math.max(active, 0) : -1;
    // Only the moment repeat is switched on decides which line loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat]);

  useEffect(() => {
    const i = loop.current;
    if (i < 0 || !status.playing) return;
    const line = lines[i];
    const end = line?.endMs ?? lines[i + 1]?.startMs;
    if (line?.startMs != null && end != null && positionMs > end + REPEAT_GAP_MS) void player.seekTo(line.startMs / 1000);
  }, [positionMs, status.playing, lines, player]);

  useEffect(() => {
    if (completed.current || !durationMs || positionMs < durationMs * COMPLETE_AT) return;
    completed.current = true;
    latest.current.onComplete();
  }, [positionMs, durationMs]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0);
  }, [status.didJustFinish, player]);

  const pause = useCallback(() => {
    player.pause();
    latest.current.onPause(player.currentTime * 1000);
  }, [player]);

  const playLine = useCallback(
    (index: number) => {
      const start = lines[index]?.startMs;
      if (start == null) return;
      if (loop.current >= 0) loop.current = index;
      void player.seekTo(start / 1000).then(() => player.play());
    },
    [lines, player]
  );

  const toggle = useCallback(() => {
    if (player.playing) pause();
    else player.play();
  }, [player, pause]);

  return {
    kind: "audio",
    loading: !status.isLoaded || status.isBuffering,
    playing: status.playing,
    active,
    positionMs,
    durationMs,
    toggle,
    pause,
    playLine,
  };
}

/** Reads the script line by line with the device voice while the lesson has no recording yet. */
export function useSpeechEngine(opts: Options): Engine {
  const { lines, speakers, rate, repeat } = opts;
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState<Record<string, string | undefined>>({});
  const token = useRef(0);
  const latest = useRef({ opts, voices, repeat, rate });
  latest.current = { opts, voices, repeat, rate };
  const completed = useRef(false);

  // Different speakers get different English voices when the device has several.
  useEffect(() => {
    let alive = true;
    Speech.getAvailableVoicesAsync()
      .then((list) => {
        if (!alive) return;
        const english = list
          .filter((v) => v.language?.toLowerCase().startsWith("en"))
          .sort((a, b) => Number(b.quality === "Enhanced") - Number(a.quality === "Enhanced"));
        const picked: Record<string, string | undefined> = {};
        speakers.forEach((key, i) => (picked[key] = english[i]?.identifier));
        setVoices(picked);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [speakers]);

  useEffect(
    () => () => {
      token.current++;
      Speech.stop();
    },
    []
  );

  const speakFrom = useCallback(
    (index: number) => {
      const t = ++token.current;
      Speech.stop();
      const line = lines[index];
      if (!line) return;
      setActive(index);
      setPlaying(true);
      const { voices: v, rate: r } = latest.current;
      Speech.speak(line.en, {
        language: "en-US",
        voice: v[line.speaker],
        rate: speechRate() * r,
        onDone: () => {
          if (t !== token.current) return;
          const last = index === lines.length - 1;
          if (!completed.current && index + 1 >= Math.ceil(lines.length * COMPLETE_AT)) {
            completed.current = true;
            latest.current.opts.onComplete();
          }
          if (latest.current.repeat) setTimeout(() => t === token.current && speakFrom(index), REPEAT_GAP_MS);
          else if (!last) setTimeout(() => t === token.current && speakFrom(index + 1), 350);
          else {
            setPlaying(false);
            setActive(-1);
          }
        },
        onError: () => {
          if (t === token.current) setPlaying(false);
        },
      });
    },
    [lines]
  );

  const pause = useCallback(() => {
    token.current++;
    Speech.stop();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else speakFrom(Math.max(active, 0));
  }, [playing, active, pause, speakFrom]);

  // A new speed only applies from the next line; restart the current one so the change is heard.
  useEffect(() => {
    if (playing) speakFrom(Math.max(active, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  return {
    kind: "speech",
    loading: false,
    playing,
    active,
    positionMs: Math.max(active, 0),
    durationMs: lines.length,
    toggle,
    pause,
    playLine: speakFrom,
  };
}
