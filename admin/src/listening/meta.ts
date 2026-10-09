import type { ListeningAudioState, ListeningKind, ListeningLesson, ListeningLine, ListeningSpeaker } from "../api";

export const KINDS: { value: ListeningKind; label: string; hint: string }[] = [
  { value: "dialogue", label: "Hội thoại", hint: "2–3 người nói chuyện" },
  { value: "story", label: "Câu chuyện", hint: "Một người kể" },
  { value: "news", label: "Bản tin", hint: "Tự soạn, không chép báo" },
];

export const kindLabel = (kind: string) => KINDS.find((k) => k.value === kind)?.label ?? kind;

export const AUDIO_STATE: Record<ListeningAudioState, { label: string; color: string }> = {
  none: { label: "Chưa có âm thanh", color: "gray" },
  ready: { label: "Có âm thanh", color: "teal" },
  stale: { label: "Cần tạo lại", color: "orange" },
  running: { label: "Đang tạo…", color: "blue" },
  failed: { label: "Tạo lỗi", color: "red" },
};

export const DEFAULT_VOICES = ["en-US-JennyNeural", "en-US-GuyNeural", "en-GB-SoniaNeural"];

export const EMPTY_LESSON: ListeningLesson = {
  slug: "",
  version: 1,
  titleEn: "",
  titleVi: "",
  kind: "dialogue",
  level: "A2",
  topic: "",
  order: 0,
  summaryVi: "",
  published: false,
  speakers: [
    { key: "a", name: "Anna", voice: "en-US-JennyNeural" },
    { key: "b", name: "Ben", voice: "en-US-GuyNeural" },
  ],
  lines: [
    { speaker: "a", en: "", vi: "" },
    { speaker: "b", en: "", vi: "" },
  ],
};

export function cleanLesson(l: ListeningLesson): ListeningLesson {
  return {
    ...l,
    topic: l.topic?.trim() || null,
    speakers: l.speakers.map((s) => ({ key: s.key.trim(), name: s.name.trim(), voice: s.voice })),
    lines: l.lines.map((x) => ({ speaker: x.speaker, en: x.en.trim(), vi: x.vi.trim() })),
  };
}

/** A short unique key for a new speaker ("a", "b", … then "s7"). */
export function nextSpeakerKey(speakers: ListeningSpeaker[]) {
  const used = new Set(speakers.map((s) => s.key));
  for (const c of "abcdefghijklmnopqrstuvwxyz") if (!used.has(c)) return c;
  let i = speakers.length + 1;
  while (used.has(`s${i}`)) i++;
  return `s${i}`;
}

export const formatDuration = (ms: number | null | undefined) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Turns pasted text into script lines. One sentence per line, optionally "Name: text" to pick the speaker
 * (matched by name or key; unknown names become new speakers) and "| bản dịch" for the translation.
 */
export function parseScript(text: string, speakers: ListeningSpeaker[]): { speakers: ListeningSpeaker[]; lines: ListeningLine[] } {
  const next = [...speakers];
  const lines: ListeningLine[] = [];
  let current = next[0]?.key ?? "a";
  for (const raw of text.split(/\r?\n/)) {
    const row = raw.trim();
    if (!row) continue;
    let body = row;
    const named = /^([^:|]{1,30}):\s*(.+)$/.exec(row);
    if (named) {
      const name = named[1].trim();
      let speaker = next.find((s) => s.name.toLowerCase() === name.toLowerCase() || s.key === name.toLowerCase());
      if (!speaker) {
        speaker = { key: nextSpeakerKey(next), name, voice: DEFAULT_VOICES[next.length % DEFAULT_VOICES.length] };
        next.push(speaker);
      }
      current = speaker.key;
      body = named[2];
    }
    const [en, ...vi] = body.split("|");
    lines.push({ speaker: current, en: en.trim(), vi: vi.join("|").trim() });
  }
  if (next.length === 0) next.push({ key: current, name: "Narrator", voice: DEFAULT_VOICES[0] });
  return { speakers: next, lines };
}
