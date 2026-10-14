import { ListeningLine } from "../api/client";

/** Lines picked for one round unless the learner chose the whole piece. */
export const ROUND_SIZE = 5;
/** Shorter lines ("Hi!", "Thanks.") are too easy to be worth typing. */
const MIN_WORDS = 3;

export type WordStatus = "ok" | "close" | "wrong" | "missing";

/** How a typed word compares with the sentence; "extra" = not in the sentence at all. */
export type TypedStatus = Exclude<WordStatus, "missing"> | "extra";

export type Marked<S> = { text: string; status: S };

export type DictationResult = {
  /** What the learner typed, word by word. */
  answer: Marked<TypedStatus>[];
  /** The correct sentence, word by word. */
  sentence: Marked<WordStatus>[];
  /** Words of the sentence typed exactly right. */
  correct: number;
  total: number;
  perfect: boolean;
};

const FIXED: Record<string, string[]> = {
  "i'm": ["i", "am"],
  "won't": ["will", "not"],
  "can't": ["can", "not"],
  "shan't": ["shall", "not"],
  "let's": ["let", "us"],
  cannot: ["can", "not"],
  ok: ["okay"],
};

/** Contractions typed without the apostrophe that cannot be mistaken for another word. */
const BARE: Record<string, string> = {
  im: "i'm", ive: "i've", youre: "you're", youve: "you've", youll: "you'll", theyre: "they're", theyve: "they've",
  theyll: "they'll", weve: "we've", hes: "he's", shes: "she's", thats: "that's", whats: "what's", theres: "there's",
  lets: "let's", dont: "don't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", arent: "aren't", wasnt: "wasn't",
  werent: "weren't", cant: "can't", couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't",
  havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", mustnt: "mustn't",
};

/** "'s" is only a verb after these; elsewhere it is a possessive and stays part of the word. */
const S_IS = new Set(["it", "that", "what", "there", "he", "she", "where", "who", "here", "how", "this"]);

/** Contraction halves that stand for more than one full word. */
const ALTERNATIVES: Record<string, string[]> = {
  "'s": ["is", "has"],
  "'d": ["would", "had"],
};

const NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

function expand(raw: string): string[] {
  const word = BARE[raw] ?? raw;
  if (FIXED[word]) return FIXED[word];
  if (/^\d+$/.test(word) && Number(word) < NUMBERS.length) return [NUMBERS[Number(word)]];
  if (word.endsWith("n't") && word.length > 3) return [word.slice(0, -3), "not"];
  const m = /^(.+)('re|'ve|'ll|'d|'s)$/.exec(word);
  if (!m) return [word];
  const [, stem, tail] = m;
  if (tail === "'s" && !S_IS.has(stem)) return [word];
  return [stem, { "'re": "are", "'ve": "have", "'ll": "will" }[tail] ?? tail];
}

/** Comparison keys of one written token: lower case, no punctuation, contractions split. */
function keysOf(token: string): string[] {
  const clean = token
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/[^a-z0-9'\-]/g, "")
    .replace(/^'+|'+$/g, "");
  return clean
    .split("-")
    .filter(Boolean)
    .flatMap(expand);
}

function same(a: string, b: string) {
  return a === b || !!ALTERNATIVES[a]?.includes(b) || !!ALTERNATIVES[b]?.includes(a);
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** One letter off in a longer word: a typo rather than a wrong word. */
function close(a: string, b: string) {
  return Math.min(a.length, b.length) >= 4 && distance(a, b) === 1;
}

type Key = { key: string; token: number };

function flatten(tokens: string[]): Key[] {
  return tokens.flatMap((t, token) => keysOf(t).map((key) => ({ key, token })));
}

type Op = { type: "match" | "sub" | "del"; e: number; t?: number } | { type: "ins"; t: number };

/** Cost of a missing or extra word. */
const GAP = 10;

/**
 * A typo pairs up more readily than a different word, so "canda" lines up under "Canada";
 * among different words the more alike one wins ("miu" goes under "milk", not "please");
 * two wrong pairs in a row cost more than one gap each side, so a stray word does not shift the rest.
 */
function pairCost(a: string, b: string) {
  if (same(a, b)) return 0;
  if (close(a, b)) return 4;
  return 12 + Math.round((6 * distance(a, b)) / Math.max(a.length, b.length));
}

/** Word-level edit script turning the sentence into what was typed. */
function align(expected: Key[], typed: Key[]): Op[] {
  const n = expected.length;
  const m = typed.length;
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i * GAP;
  for (let j = 0; j <= m; j++) cost[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = pairCost(expected[i - 1].key, typed[j - 1].key);
      cost[i][j] = Math.min(cost[i - 1][j - 1] + sub, cost[i - 1][j] + GAP, cost[i][j - 1] + GAP);
    }
  }

  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sub = pairCost(expected[i - 1].key, typed[j - 1].key);
      if (cost[i][j] === cost[i - 1][j - 1] + sub) {
        ops.push({ type: sub === 0 ? "match" : "sub", e: i - 1, t: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + GAP) {
      ops.push({ type: "del", e: i - 1 });
      i--;
    } else {
      ops.push({ type: "ins", t: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

/** Keyboards may insert zero-width characters; a token with no letter or digit ("?", ",") is not a word. */
function typedTokens(answer: string) {
  return answer
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, " ")
    .split(/\s+/)
    .filter((t) => keysOf(t).length > 0);
}

export function checkDictation(sentence: string, answer: string): DictationResult {
  const words = sentence.split(/\s+/).filter(Boolean);
  const typedWords = typedTokens(answer);
  const expected = flatten(words);
  const typed = flatten(typedWords);
  const ops = align(expected, typed);

  const states: { status: WordStatus; typed: Set<number> }[] = words.map(() => ({ status: "ok", typed: new Set() }));
  const rank: Record<WordStatus, number> = { ok: 0, close: 1, missing: 2, wrong: 3 };
  const worsen = (w: number, s: WordStatus) => {
    if (rank[s] > rank[states[w].status]) states[w].status = s;
  };
  const keyCount = words.map((_, w) => expected.filter((k) => k.token === w).length);
  const missingKeys = words.map(() => 0);

  for (const op of ops) {
    if (op.type === "ins") continue;
    const w = expected[op.e].token;
    if (op.type === "del") {
      missingKeys[w]++;
      worsen(w, "wrong");
      continue;
    }
    states[w].typed.add(typed[op.t!].token);
    if (op.type === "sub") worsen(w, close(expected[op.e].key, typed[op.t!].key) ? "close" : "wrong");
  }
  const typedText = (set: Set<number>) => [...set].sort((a, b) => a - b).map((t) => typedWords[t]).join(" ");
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  words.forEach((text, w) => {
    const s = states[w];
    if (keyCount[w] > 0 && missingKeys[w] === keyCount[w]) s.status = "missing";
    // "its" for "It's": right word, only the apostrophe is missing.
    else if (s.status === "wrong" && s.typed.size && letters(typedText(s.typed)) === letters(text)) s.status = "close";
  });

  // A typed word takes the mark of the sentence word it was paired with; unpaired ones are extra.
  const typedMarks: TypedStatus[] = typedWords.map(() => "extra");
  states.forEach(({ status, typed: t }) => {
    for (const i of t) {
      const mark: TypedStatus = status === "missing" ? "wrong" : status;
      const cur = typedMarks[i];
      if (cur === "extra" || rank[mark] > rank[cur]) typedMarks[i] = mark;
    }
  });

  const answerMarks = typedWords.map((text, i) => ({ text, status: typedMarks[i] }));
  const sentenceMarks = words.map((text, w) => ({ text, status: states[w].status }));
  const correct = states.filter((s, w) => s.status === "ok" && keyCount[w] > 0).length;
  const total = keyCount.filter((c) => c > 0).length;
  const perfect = correct === total && !typedMarks.includes("extra");
  return { answer: answerMarks, sentence: sentenceMarks, correct, total, perfect };
}

/** "I'm going home." -> "I'_ g____ h___." so the learner sees word lengths and first letters. */
export function firstLetters(sentence: string) {
  return sentence
    .split(/(\s+)/)
    .map((part) => {
      let seen = false;
      return [...part]
        .map((ch) => {
          if (!/[A-Za-z0-9]/.test(ch)) return ch;
          if (seen) return "_";
          seen = true;
          return ch;
        })
        .join("");
    })
    .join("");
}

export function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lines already given per piece while the app is open, so the next round brings different ones. */
const given = new Map<string, Set<number>>();

/** Indices of the lines to type, in the order they appear in the piece. */
export function pickLines(slug: string, lines: ListeningLine[], all: boolean): number[] {
  const indices = lines.map((_, i) => i);
  if (all) return indices;
  const long = indices.filter((i) => wordCount(lines[i].en) >= MIN_WORDS);
  const pool = long.length >= ROUND_SIZE ? long : indices;

  const seen = given.get(slug) ?? new Set<number>();
  const fresh = shuffle(pool.filter((i) => !seen.has(i)));
  let picked = fresh.slice(0, ROUND_SIZE);
  if (picked.length < ROUND_SIZE) {
    // Every line has come up once: start over, topping up with lines not in this round.
    seen.clear();
    picked = [...picked, ...shuffle(pool.filter((i) => !picked.includes(i))).slice(0, ROUND_SIZE - picked.length)];
  }
  picked.forEach((i) => seen.add(i));
  given.set(slug, seen);
  return picked.sort((a, b) => a - b);
}
