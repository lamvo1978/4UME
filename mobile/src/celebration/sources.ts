/** Grok Make Video exports — all 400×736, ~6s. */
export const CELEBRATION_DONE = require("../../assets/celebration/celebration-done.mp4");
/** Streak +1 day modal (file name `steak` on disk). */
export const CELEBRATION_STREAK = require("../../assets/celebration/steak.mp4");
export const CELEBRATION_GIFT = require("../../assets/celebration/gift.mp4");

export const CELEBRATION_WIDTH_OVER_HEIGHT = 400 / 736;

/** Match `colors.bg` when re-exporting Grok clips so the sky blends with Ôn tập screens. */
export const CELEBRATION_EXPORT_BG = "#E7F2EC";

/** Cap width/height so portrait celebration clips do not dominate small screens. */
export const CELEBRATION_MAX_WIDTH = 240;
export const CELEBRATION_MAX_HEIGHT = 280;

export function celebrationWidth(windowWidth: number, horizontalInset = 48) {
  let w = Math.min(windowWidth - horizontalInset, CELEBRATION_MAX_WIDTH);
  const h = w / CELEBRATION_WIDTH_OVER_HEIGHT;
  if (h > CELEBRATION_MAX_HEIGHT) w = CELEBRATION_MAX_HEIGHT * CELEBRATION_WIDTH_OVER_HEIGHT;
  return Math.round(w);
}
