import { WeekDay, WeekSummary } from "../api/client";
import { parseDay } from "../utils/dates";

/** Grammar items take longer than a flashcard, so they weigh more (same as the activity calendar). */
export const dayActivity = (d: Pick<WeekDay, "newWords" | "reviews" | "grammarItems" | "listens" | "dictationLines">) =>
  d.newWords + d.reviews + d.grammarItems * 3 + d.listens * 3 + d.dictationLines;

const weekActivity = (w: WeekSummary) => dayActivity(w);

/** "6/10 – 12/10" */
export function weekRange(w: WeekSummary) {
  const a = parseDay(w.start);
  const b = parseDay(w.end);
  return `${a.getDate()}/${a.getMonth() + 1} – ${b.getDate()}/${b.getMonth() + 1}`;
}

/** Only ever encouraging: a quieter week gets a nudge, never a percentage drop. */
export function comparison(week: WeekSummary, previous: WeekSummary | undefined): string | null {
  if (!previous || previous.studyDays === 0) return null;
  const now = weekActivity(week);
  const before = weekActivity(previous);
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct >= 10) return `Chăm hơn tuần trước đó ${pct}%`;
  if (pct > -10) return "Đều đặn như tuần trước đó";
  return week.inProgress ? null : "Tuần này bận hơn một chút, mỗi ngày vài phút là đủ giữ nhịp";
}