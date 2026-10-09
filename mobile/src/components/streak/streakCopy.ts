export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000];
export const FREEZE_EVERY = 7;

export function streakStatus(streak: number, studiedToday: boolean) {
  if (studiedToday) return "Hôm nay bạn đã giữ lửa. Hẹn gặp lại ngày mai!";
  if (streak > 0) return `Học một lượt hôm nay để giữ chuỗi ${streak} ngày.`;
  return "Học một lượt bất kỳ để bắt đầu chuỗi mới.";
}

export function milestoneLine(streak: number, next: number | null) {
  if (MILESTONES.includes(streak)) return `Bạn vừa đạt mốc ${streak} ngày!`;
  if (streak === 1) return "Khởi đầu tuyệt vời! Quay lại ngày mai để giữ lửa nhé.";
  if (next) return `Còn ${next - streak} ngày nữa tới mốc ${next} ngày`;
  return "Bạn là huyền thoại của 4UME!";
}

/** Previous milestone (or 0) – used as the start of the progress bar toward the next one. */
export function previousMilestone(streak: number) {
  return [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
}
