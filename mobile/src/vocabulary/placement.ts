import { GrammarLesson, VOCAB_LEVELS, VocabLevel } from "../api/client";

/** Per level: pass with `pass` right answers, stop at `fail` wrong ones. */
export type LevelRules = { pass: number; fail: number };
/** Vocabulary: at most 6 questions per level. */
export const VOCAB_RULES: LevelRules = { pass: 5, fail: 2 };
/** Grammar: at most 4 questions per level (the server sends exactly 4). */
export const GRAMMAR_RULES: LevelRules = { pass: 3, fail: 2 };

export type LevelScore = { level: VocabLevel; correct: number; wrong: number; passed: boolean | null };

type TestLevel = { level: VocabLevel; questions: unknown[] };

export type PlacementState = {
  levelIndex: number;
  questionIndex: number;
  scores: LevelScore[];
  /** Set when the test is over: the first level not passed (the last level if every level passed). */
  result: VocabLevel | null;
};

export function startPlacement(levels: TestLevel[]): PlacementState {
  return {
    levelIndex: 0,
    questionIndex: 0,
    scores: levels.map((l) => ({ level: l.level, correct: 0, wrong: 0, passed: null })),
    result: null,
  };
}

/** "Không biết" counts as wrong; running out of questions in a level counts as not passing it. */
export function answerPlacement(state: PlacementState, levels: TestLevel[], correct: boolean, rules = VOCAB_RULES): PlacementState {
  const scores = state.scores.map((s, i) =>
    i === state.levelIndex ? { ...s, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) } : s
  );
  const score = scores[state.levelIndex];
  const questionIndex = state.questionIndex + 1;
  const outOfQuestions = questionIndex >= levels[state.levelIndex].questions.length;

  if (score.correct >= rules.pass) {
    scores[state.levelIndex] = { ...score, passed: true };
    const nextLevel = state.levelIndex + 1;
    if (nextLevel >= levels.length) return { ...state, scores, result: levels[levels.length - 1].level };
    return { levelIndex: nextLevel, questionIndex: 0, scores, result: null };
  }
  if (score.wrong >= rules.fail || outOfQuestions) {
    scores[state.levelIndex] = { ...score, passed: false };
    return { ...state, questionIndex, scores, result: score.level };
  }
  return { ...state, questionIndex, scores };
}

export const levelRank = (level: VocabLevel | null) => (level ? VOCAB_LEVELS.indexOf(level) : -1);

/**
 * Where to start grammar: the earliest lesson missed at the first level not passed, else that level's first lesson;
 * after passing every tested level, the first lesson above them. Null when no lesson fits.
 */
export function suggestGrammarLesson(state: PlacementState, missedSlugs: string[], lessons: GrammarLesson[]) {
  const allPassed = state.scores.every((s) => s.passed);
  const last = state.scores[state.scores.length - 1]?.level ?? null;
  if (allPassed) return lessons.find((l) => levelRank(l.level as VocabLevel) > levelRank(last)) ?? null;
  const level = state.result;
  const atLevel = lessons.filter((l) => l.level === level);
  return atLevel.find((l) => missedSlugs.includes(l.slug)) ?? atLevel[0] ?? null;
}

export const LEVEL_BLURB: Record<VocabLevel, string> = {
  A1: "Bắt đầu với những từ cơ bản nhất: chào hỏi, gia đình, đồ vật quen thuộc.",
  A2: "Bạn đã biết các từ A1. Tiếp tục với từ vựng cho sinh hoạt hằng ngày.",
  B1: "Bạn đã vững từ A1–A2. Tiếp tục với từ cho công việc, du lịch, ý kiến.",
  B2: "Bạn đã vững từ A1–B1. Tiếp tục với từ vựng phong phú, trừu tượng hơn.",
};

/** "Từ A1" / "Từ A1–A2" … for words below the given level. */
export function easierLabel(level: VocabLevel) {
  const below = VOCAB_LEVELS.slice(0, levelRank(level));
  if (below.length === 0) return "";
  return below.length === 1 ? below[0] : `${below[0]}–${below[below.length - 1]}`;
}
