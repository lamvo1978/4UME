import { GrammarExercise } from "../api/client";
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
  }
}

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
  }
}
