import type { PlacementGrammarInput, PlacementLevel } from "../api";

export const PLACEMENT_LEVELS: PlacementLevel[] = ["A1", "A2", "B1", "B2"];

/** Must match GrammarPlacementRules.MinPerLevel: a level with fewer published questions is left out of the test. */
export const MIN_PER_LEVEL = 4;
/** Enough for learners who retake the test to rarely see the same questions. */
export const GOOD_PER_LEVEL = 20;

export const emptyQuestion = (level: PlacementLevel): PlacementGrammarInput => ({
  level,
  prompt: "",
  options: ["", "", ""],
  answer: "",
  explanationVi: "",
  lessonSlug: null,
  published: true,
});
