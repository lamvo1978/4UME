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

const GREETING = /^((?:Hi|Hello|Hey|Dear)\b[^.!?,\n]{0,30}[,!])\s+/;
const CLOSING =
  /\s+((?:Love|Best wishes|Best regards|Kind regards|Regards|See you soon|See you|Write soon|Take care|Cheers|Bye for now)\b[^.!?\n]{0,25}[.!,]?(?:\s+[A-Z][a-z]+\.?)?)\s*$/;
/** Shorter bodies read fine as one paragraph. */
const SPLIT_FROM_WORDS = 50;

/**
 * Line breaks for a cloze text. Breaks written by the editor win; otherwise each speaker turn of a dialogue
 * ("A: … B: …") gets its own line, a letter's greeting and sign-off stand alone, and a long body is split in two
 * at the sentence end nearest the middle.
 */
export function clozeLines(text: string) {
  text = text.replace(/[ \t]*\n[ \t]*/g, "\n").trim();
  if (text.includes("\n")) return text;
  const dialogue = text.replace(/\s+(?=[A-Z][a-z]{0,10}: )/g, "\n");
  if (dialogue !== text) return dialogue;

  let body = text;
  const greeting = body.match(GREETING);
  if (greeting) body = body.slice(greeting[0].length);
  const closing = body.match(CLOSING);
  if (closing?.index) body = body.slice(0, closing.index);
  return [greeting?.[1], splitBody(body), closing?.index ? closing[1] : null].filter(Boolean).join("\n");
}

function splitBody(body: string) {
  if (body.split(/\s+/).length < SPLIT_FROM_WORDS) return body;
  const ends = [...body.matchAll(/[.!?]["”]?\s+(?=["“]?[A-Z])/g)]
    .filter((m) => !/\b(Mr|Mrs|Ms|Dr|St)\.$/.test(body.slice(0, (m.index ?? 0) + 1)))
    .map((m) => (m.index ?? 0) + m[0].length);
  if (ends.length === 0) return body;
  const middle = body.length / 2;
  const at = ends.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));
  return `${body.slice(0, at).trimEnd()}\n${body.slice(at)}`;
}

const FILL_GAP = /_{3,}(\s*\([^)]*\))?/;

function stripGapHint(text: string) {
  return text.replace(/^\s*\([^)]*\)/, "").trimStart();
}

/** Text for the blank only — drops words that already appear right after `___` in the prompt. */
export function fillGapInsert(prompt: string, answer: string) {
  const m = prompt.match(/^(.*?)(_{3,})(\s*\([^)]*\))?(.*)$/s);
  if (!m) return answer.trim();
  const after = normalizeAnswer(stripGapHint(m[4]), true);
  const gapWords = [...wordsOf(answer)];
  let afterWords = [...wordsOf(after)];
  while (gapWords.length > 0 && afterWords.length > 0 && gapWords[gapWords.length - 1] === afterWords[0]) {
    gapWords.pop();
    afterWords.shift();
  }
  const trimmed = gapWords.join(" ");
  return trimmed || answer.trim();
}

function fillAccepted(prompt: string, answers: string[]) {
  const ok = new Set<string>();
  for (const a of answers) {
    ok.add(normalizeAnswer(a, true));
    ok.add(normalizeAnswer(fillGapInsert(prompt, a), true));
  }
  return ok;
}

/** Full sentence for a fill prompt, with the parenthetical hint removed. */
export function fillSentence(prompt: string, answer: string) {
  return prompt.replace(FILL_GAP, fillGapInsert(prompt, answer)).replace(/\s*\([^)]*\)/, "");
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

/** mcq: primary answer plus any other accepted options. */
export function mcqAccepted(ex: Extract<GrammarExercise, { type: "mcq" }>) {
  const ok = new Set<string>([ex.answer]);
  for (const a of ex.acceptedAnswers ?? []) ok.add(a);
  return ok;
}

export function mcqIsCorrect(ex: Extract<GrammarExercise, { type: "mcq" }>, given: string) {
  return mcqAccepted(ex).has(given);
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
      return fillSentence(ex.prompt, ex.answers[0]);
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
      return mcqIsCorrect(ex, given);
    case "fill":
      return fillAccepted(ex.prompt, ex.answers).has(normalizeAnswer(given, true));
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
