import AsyncStorage from "@react-native-async-storage/async-storage";
import { WeekDay, WeekSummary } from "../api/client";
import { parseDay } from "../utils/dates";

/** Grammar items take longer than a flashcard, so they weigh more (same as the activity calendar). */
export const dayActivity = (d: Pick<WeekDay, "newWords" | "reviews" | "grammarItems" | "listens">) =>
  d.newWords + d.reviews + d.grammarItems * 3 + d.listens * 3;

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

/** The non-zero numbers, in the order they read best: "42 từ mới · 120 lượt ôn · đọc chuẩn 18 từ". */
export function highlights(w: WeekSummary): string[] {
  const parts: string[] = [];
  if (w.newWords) parts.push(`${w.newWords} từ mới`);
  if (w.reviews) parts.push(`${w.reviews} lượt ôn`);
  if (w.grammarItems) parts.push(`${w.grammarItems} lượt ngữ pháp`);
  if (w.listens) parts.push(`${w.listens} bài nghe`);
  if (w.goodPronunciations) parts.push(`đọc chuẩn ${w.goodPronunciations} từ`);
  return parts;
}

const dismissKey = (userId: string) => `4ume.weeklyDismissed.${userId}`;

export async function isDismissed(userId: string, weekStart: string) {
  return (await AsyncStorage.getItem(dismissKey(userId))) === weekStart;
}

export function dismiss(userId: string, weekStart: string) {
  return AsyncStorage.setItem(dismissKey(userId), weekStart);
}
