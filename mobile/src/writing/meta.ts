import type { VocabLevel, WritingCorrectionKind } from "../api/client";
import { colors } from "../theme";

/** Same ranges as WritingRules.WordRange on the server, for free writing and prompts without their own. */
export function wordRange(level: VocabLevel): [number, number] {
  switch (level) {
    case "A1":
      return [30, 80];
    case "A2":
      return [50, 120];
    case "B1":
      return [80, 180];
    default:
      return [120, 250];
  }
}

/** The server needs at least this many words to grade. */
export const MIN_WORDS = 10;
/** About 250 words; longer texts don't fit the AI's limits. */
export const MAX_CHARS = 1500;

export const countWords = (text: string) => text.split(/\s+/).filter((w) => /[A-Za-z0-9À-ỹ]/.test(w)).length;

export const KIND_LABELS: Record<WritingCorrectionKind, string> = {
  grammar: "Ngữ pháp",
  word: "Dùng từ",
  spelling: "Chính tả",
  punctuation: "Dấu câu",
  style: "Diễn đạt",
};

export function scoreColor(score: number) {
  if (score >= 80) return colors.accent;
  if (score >= 60) return colors.gold;
  return colors.flameDeep;
}

export function scoreVerdict(score: number) {
  if (score >= 85) return "Rất tốt!";
  if (score >= 70) return "Tốt lắm!";
  if (score >= 55) return "Khá ổn, sửa thêm chút nữa nhé";
  return "Cố lên, xem lỗi bên dưới nhé";
}
