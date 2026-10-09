/** Reminder texts. `seed` is a day number, so consecutive days never get the same variant. */

function pick<T>(items: T[], seed: number): T {
  return items[((seed % items.length) + items.length) % items.length];
}

export type Content = { title: string; body: string };

export function dueTitle(words: number, grammar: number, seed: number) {
  const parts = [words > 0 ? `${words} từ` : null, grammar > 0 ? `${grammar} bài ngữ pháp` : null].filter(Boolean);
  const what = parts.join(" và ");
  return pick(
    [`Có ${what} cần ôn hôm nay`, `${what} đang chờ bạn ôn lại`, `Đến giờ ôn ${what} rồi`],
    seed
  );
}

export function newWordsTitle(count: number, seed: number) {
  return pick(
    [`Học ${count} từ mới hôm nay nhé`, `${count} từ mới đang đợi bạn`, `Thêm ${count} từ mới vào vốn từ nào`],
    seed
  );
}

export function encouragementTitle(seed: number) {
  return pick(
    ["Vài phút tiếng Anh mỗi ngày", "Hôm nay mình học gì nhỉ?", "Một chút mỗi ngày, tiến bộ mỗi tuần"],
    seed
  );
}

/** Secondary line of the daily reminder: streak, or the next milestone when it is close. */
export function streakLine(streakToKeep: number, nextMilestone: number | null, seed: number) {
  if (streakToKeep <= 0) {
    return pick(["Chỉ cần 5 phút để bắt đầu chuỗi ngày học.", "Bắt đầu chuỗi ngày học từ hôm nay nhé."], seed);
  }
  const toMilestone = nextMilestone ? nextMilestone - streakToKeep : null;
  if (nextMilestone && toMilestone !== null && toMilestone >= 1 && toMilestone <= 2) {
    return toMilestone === 1
      ? `Học hôm nay là đạt mốc ${nextMilestone} ngày!`
      : `Còn ${toMilestone} ngày nữa là đạt mốc ${nextMilestone} ngày!`;
  }
  return pick(
    [`Giữ chuỗi ${streakToKeep} ngày nhé!`, `Chuỗi ${streakToKeep} ngày đang chờ bạn nối dài.`, `Đừng để chuỗi ${streakToKeep} ngày tắt lửa nhé.`],
    seed
  );
}

export function rescueContent(opts: {
  streak: number;
  hoursLeft: number;
  /** Freezes left after the days already missed; one more miss is covered when > 0. */
  freezesLeft: number;
  seed: number;
}): Content {
  const { streak, hoursLeft, freezesLeft, seed } = opts;
  if (freezesLeft > 0) {
    return {
      title: `Hôm nay bạn chưa học`,
      body: pick(
        [
          `Bỏ lỡ hôm nay sẽ tốn 1 lượt đóng băng của chuỗi ${streak} ngày. 3 phút ôn tập là đủ!`,
          `Giữ lượt đóng băng cho lúc cần hơn — học nhanh vài từ để nối chuỗi ${streak} ngày nhé.`,
        ],
        seed
      ),
    };
  }
  const left = hoursLeft >= 1 ? `${hoursLeft} tiếng` : "chưa đầy 1 tiếng";
  return {
    title: pick([`Còn ${left} nữa là mất chuỗi ${streak} ngày`, `Chuỗi ${streak} ngày sắp tắt lửa`], seed),
    body: pick(
      ["3 phút ôn tập là đủ để giữ chuỗi!", "Học nhanh vài từ trước khi đi ngủ nhé.", "Một lượt ôn ngắn thôi là chuỗi được cứu."],
      seed
    ),
  };
}

export function comebackContent(daysAway: number, dueCount: number, seed: number): Content {
  return {
    title: pick(["Lâu rồi không gặp!", "4UME nhớ bạn đấy", "Quay lại học chút nhé?"], seed),
    body:
      dueCount > 0
        ? `Đã ${daysAway} ngày rồi — ôn lại ${Math.min(dueCount, 5)} từ cũ trong 2 phút nhé.`
        : `Đã ${daysAway} ngày rồi — học vài từ mới để bắt đầu lại chuỗi nhé.`,
  };
}
