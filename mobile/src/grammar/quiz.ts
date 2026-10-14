import { GrammarExercise, VerbNote } from "../api/client";
import { shuffle } from "../utils/shuffle";

export type QuizItem = {
  key: string;
  slug: string;
  /** Shown above the question in mixed review sessions. */
  label?: string;
  exercise: GrammarExercise;
};

export type QuizResult = {
  total: number;
  firstTryCorrect: number;
  mistakesBySlug: Record<string, number>;
  /** Questions answered wrong at least once, in the order they were first missed. */
  missed: QuizItem[];
};

/** Picks `count` exercises at random, rotating through the types so one session mixes them. */
export function sampleExercises(pool: GrammarExercise[], count: number): GrammarExercise[] {
  const byType = new Map<string, GrammarExercise[]>();
  for (const ex of shuffle(pool)) byType.set(ex.type, [...(byType.get(ex.type) ?? []), ex]);
  const queues = shuffle([...byType.values()]);
  const picked: GrammarExercise[] = [];
  while (picked.length < Math.min(count, pool.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return shuffle(picked);
}

const KNOWN_TYPES = new Set<string>(["mcq", "fill", "order", "transform", "error", "cloze"]);

/** Drops exercise types this build can't render (added to the lesson schema later). */
export function playable(pool: GrammarExercise[] | undefined) {
  return (pool ?? []).filter((ex) => KNOWN_TYPES.has(ex.type));
}

/** Review/practice draw from the lesson's extra practice bank first, topped up from the lesson quiz. */
export function sampleForSession(item: { exercises: GrammarExercise[]; practice?: GrammarExercise[] }, count: number) {
  const fromPractice = sampleExercises(playable(item.practice), count);
  if (fromPractice.length >= count) return fromPractice;
  const used = new Set(fromPractice.map((ex) => ex.id));
  const extra = sampleExercises(
    playable(item.exercises).filter((ex) => !used.has(ex.id)),
    count - fromPractice.length
  );
  return shuffle([...fromPractice, ...extra]);
}

/** A gap in a cloze paragraph: `___` with an optional "(hint)" right after it. */
const CLOZE_GAP = /_{3,}(\s*\([^)]*\))?/g;

/** Dialogues are stored on one line ("A: … B: …"); each speaker turn starts a new line on screen. */
export function clozeLines(text: string) {
  return text.replace(/\s+(?=[A-Z][a-z]{0,10}: )/g, "\n");
}

/** Splits a cloze paragraph into text runs around the gaps; `hints[i]` belongs to gap i. */
export function splitCloze(prompt: string) {
  const parts: string[] = [];
  const hints: (string | null)[] = [];
  let last = 0;
  prompt = clozeLines(prompt);
  for (const m of prompt.matchAll(CLOZE_GAP)) {
    parts.push(prompt.slice(last, m.index));
    hints.push(m[1] ? m[1].trim().slice(1, -1).trim() : null);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(prompt.slice(last));
  return { parts, hints };
}

const wordsOf = (s: string): string[] => s.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:'[a-z]+)*/g) ?? [];

/**
 * The tagged verb phrase a tapped word belongs to. Before the answer is checked only phrases written out in full
 * on screen count, so a gap's answer ("were" in "___ preparing") is never given away.
 */
export function verbFor(verbs: VerbNote[] | undefined, word: string, shown: string, answered: boolean): VerbNote | null {
  const candidates = (verbs ?? []).filter((v) => wordsOf(v.phrase).includes(word.replace(/’/g, "'")));
  const text = ` ${wordsOf(shown).join(" ")} `;
  return candidates.find((v) => text.includes(` ${wordsOf(v.phrase).join(" ")} `)) ?? (answered ? (candidates[0] ?? null) : null);
}

export function clozeGapCorrect(accepted: string[], given: string) {
  return accepted.some((a) => normalizeAnswer(a, true) === normalizeAnswer(given, true));
}

export function normalizeAnswer(s: string, stripEndPunctuation = false) {
  let out = s.replace(/[’‘]/g, "'").trim().toLowerCase().replace(/\s+/g, " ");
  if (stripEndPunctuation) out = out.replace(/[.!?,;:]+$/, "").trim();
  return out;
}

/** "She [are] a doctor." → tokens ["She", "are", "a", "doctor."], wrongIndex 1. */
export function parseErrorSentence(sentence: string) {
  const match = sentence.match(/^(.*?)\[(.+?)\](.*)$/);
  if (!match) return { tokens: sentence.split(/\s+/).filter(Boolean), wrongIndex: -1, wrongText: "" };
  const [, before, inside, after] = match;
  const beforeTokens = before.trim() ? before.trim().split(/\s+/) : [];
  const afterTrim = after.trimStart();
  // Punctuation glued to the bracket ("[goes].") stays with the wrong word.
  const glued = after.length > 0 && !/^\s/.test(after) ? afterTrim.split(/\s+/)[0] : "";
  const rest = glued ? afterTrim.slice(glued.length) : afterTrim;
  const afterTokens = rest.trim() ? rest.trim().split(/\s+/) : [];
  return {
    tokens: [...beforeTokens, inside + glued, ...afterTokens],
    wrongIndex: beforeTokens.length,
    wrongText: inside,
  };
}

export function correctedErrorSentence(sentence: string, correction: string) {
  return sentence.replace(/\[(.+?)\]/, correction);
}

/** The answer shown in feedback, as a full sentence when possible. */
export function displayAnswer(ex: GrammarExercise) {
  switch (ex.type) {
    case "mcq":
      return ex.prompt.includes("___") ? ex.prompt.replace(/_{3,}/, ex.answer) : ex.answer;
    case "fill":
      return ex.prompt.replace(/_{3,}/, ex.answers[0]).replace(/\s*\([^)]*\)/, "");
    case "order":
    case "transform":
      return ex.answer;
    case "error":
      return correctedErrorSentence(ex.sentence, ex.correction);
    case "cloze": {
      let i = 0;
      return clozeLines(ex.prompt.replace(CLOZE_GAP, () => ex.blanks[i++]?.[0] ?? "___"));
    }
  }
}

/** For cloze, `given` is a JSON array with one answer per gap. */
export function isCorrect(ex: GrammarExercise, given: string) {
  switch (ex.type) {
    case "mcq":
      return given === ex.answer;
    case "fill":
      return ex.answers.some((a) => normalizeAnswer(a, true) === normalizeAnswer(given, true));
    case "order":
    case "transform":
      return normalizeAnswer(given) === normalizeAnswer(ex.answer);
    case "error":
      return given === "correct";
    case "cloze": {
      const values = parseClozeGiven(given);
      return ex.blanks.length > 0 && ex.blanks.every((accepted, i) => clozeGapCorrect(accepted, values[i] ?? ""));
    }
  }
}

function parseClozeGiven(given: string): string[] {
  try {
    const v = JSON.parse(given);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
