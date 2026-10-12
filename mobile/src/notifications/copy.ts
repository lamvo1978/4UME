import type { NotificationTexts } from "../api/client";

/**
 * Reminder texts. The wording comes from the admin (Thông báo) via /api/config; these defaults mirror the server's
 * and cover older servers or a failed fetch. `seed` is a day number, so consecutive days never get the same variant.
 */
export const DEFAULT_TEXTS: NotificationTexts = {
  dueTitles: ["Có {what} cần ôn hôm nay", "{what} đang chờ bạn ôn lại", "Đến giờ ôn {what} rồi"],
  newWordsTitles: ["Học {count} từ mới hôm nay nhé", "{count} từ mới đang đợi bạn", "Thêm {count} từ mới vào vốn từ nào"],
  encouragementTitles: ["Vài phút tiếng Anh mỗi ngày", "Hôm nay mình học gì nhỉ?", "Một chút mỗi ngày, tiến bộ mỗi tuần"],
  startStreakLines: ["Chỉ cần 5 phút để bắt đầu chuỗi ngày học.", "Bắt đầu chuỗi ngày học từ hôm nay nhé."],
  streakLines: ["Giữ chuỗi {streak} ngày nhé!", "Chuỗi {streak} ngày đang chờ bạn nối dài.", "Đừng để chuỗi {streak} ngày tắt lửa nhé."],
  milestoneTomorrow: "Học hôm nay là đạt mốc {milestone} ngày!",
  milestoneSoon: "Còn {days} ngày nữa là đạt mốc {milestone} ngày!",
  rescueFreezeTitle: "Hôm nay bạn chưa học",
  rescueFreezeBodies: [
    "Bỏ lỡ hôm nay sẽ tốn 1 lượt đóng băng của chuỗi {streak} ngày. 3 phút ôn tập là đủ!",
    "Giữ lượt đóng băng cho lúc cần hơn — học nhanh vài từ để nối chuỗi {streak} ngày nhé.",
  ],
  rescueTitles: ["Còn {left} nữa là mất chuỗi {streak} ngày", "Chuỗi {streak} ngày sắp tắt lửa"],
  rescueBodies: ["3 phút ôn tập là đủ để giữ chuỗi!", "Học nhanh vài từ trước khi đi ngủ nhé.", "Một lượt ôn ngắn thôi là chuỗi được cứu."],
  comebackTitles: ["Lâu rồi không gặp!", "4UME nhớ bạn đấy", "Quay lại học chút nhé?"],
  comebackDueBody: "Đã {days} ngày rồi — ôn lại {count} từ cũ trong 2 phút nhé.",
  comebackNewBody: "Đã {days} ngày rồi — học vài từ mới để bắt đầu lại chuỗi nhé.",
  promptTitle: "Giữ lửa mỗi ngày nhé?",
  promptBody: "4UME sẽ nhắc bạn học lúc {time} mỗi ngày. Bạn đổi giờ hoặc tắt bất cứ lúc nào trong Hồ sơ › Cài đặt.",
};

/** Server texts over the defaults; empty values fall back so a bad save never sends a blank reminder. */
export function resolveTexts(server?: Partial<NotificationTexts> | null): NotificationTexts {
  if (!server) return DEFAULT_TEXTS;
  const texts = { ...DEFAULT_TEXTS } as Record<keyof NotificationTexts, string | string[]>;
  for (const key of Object.keys(DEFAULT_TEXTS) as (keyof NotificationTexts)[]) {
    const value = server[key];
    if (Array.isArray(value)) {
      const items = value.filter((v) => typeof v === "string" && v.trim());
      if (items.length) texts[key] = items;
    } else if (typeof value === "string" && value.trim()) {
      texts[key] = value;
    }
  }
  return texts as NotificationTexts;
}

export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

function pick<T>(items: T[], seed: number): T {
  return items[((seed % items.length) + items.length) % items.length];
}

export type Content = { title: string; body: string };

export function dueTitle(t: NotificationTexts, words: number, grammar: number, seed: number) {
  const parts = [words > 0 ? `${words} từ` : null, grammar > 0 ? `${grammar} bài ngữ pháp` : null].filter(Boolean);
  return fill(pick(t.dueTitles, seed), { what: parts.join(" và ") });
}

export function newWordsTitle(t: NotificationTexts, count: number, seed: number) {
  return fill(pick(t.newWordsTitles, seed), { count });
}

export function encouragementTitle(t: NotificationTexts, seed: number) {
  return pick(t.encouragementTitles, seed);
}

/** Secondary line of the daily reminder: streak, or the next milestone when it is close. */
export function streakLine(t: NotificationTexts, streakToKeep: number, nextMilestone: number | null, seed: number) {
  if (streakToKeep <= 0) return pick(t.startStreakLines, seed);
  const toMilestone = nextMilestone ? nextMilestone - streakToKeep : null;
  if (nextMilestone && toMilestone !== null && toMilestone >= 1 && toMilestone <= 2) {
    return fill(toMilestone === 1 ? t.milestoneTomorrow : t.milestoneSoon, { milestone: nextMilestone, days: toMilestone });
  }
  return fill(pick(t.streakLines, seed), { streak: streakToKeep });
}

export function rescueContent(
  t: NotificationTexts,
  opts: {
    streak: number;
    hoursLeft: number;
    /** Freezes left after the days already missed; one more miss is covered when > 0. */
    freezesLeft: number;
    seed: number;
  }
): Content {
  const { streak, hoursLeft, freezesLeft, seed } = opts;
  if (freezesLeft > 0) {
    return {
      title: fill(t.rescueFreezeTitle, { streak }),
      body: fill(pick(t.rescueFreezeBodies, seed), { streak }),
    };
  }
  const left = hoursLeft >= 1 ? `${hoursLeft} tiếng` : "chưa đầy 1 tiếng";
  return {
    title: fill(pick(t.rescueTitles, seed), { streak, left }),
    body: fill(pick(t.rescueBodies, seed), { streak }),
  };
}

export function comebackContent(t: NotificationTexts, daysAway: number, dueCount: number, seed: number): Content {
  return {
    title: fill(pick(t.comebackTitles, seed), { days: daysAway }),
    body:
      dueCount > 0
        ? fill(t.comebackDueBody, { days: daysAway, count: Math.min(dueCount, 5) })
        : fill(t.comebackNewBody, { days: daysAway }),
  };
}
