import type { NotificationConfig } from "../api";

/** Same limits as backend NotificationConfigRules. */
export const LIMITS = { minPerDay: 1, maxPerDay: 3, maxRescueMinStreak: 30, maxComebackLocal: 7, maxComebackPush: 60, maxComebackEntries: 6 };

export const toMinutes = (t: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function inQuiet(minutes: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Problems keyed by field, so each message shows next to its input. */
export function validate(c: NotificationConfig): Partial<Record<keyof NotificationConfig, string>> {
  const errors: Partial<Record<keyof NotificationConfig, string>> = {};
  const times = ["rescueTime", "quietStart", "quietEnd", "weeklyTime", "freezeNoticeTime"] as const;
  for (const k of times) if (toMinutes(c[k]) === null) errors[k] = "Chọn giờ dạng giờ:phút.";

  const qs = toMinutes(c.quietStart);
  const qe = toMinutes(c.quietEnd);
  if (qs !== null && qe !== null) {
    const rescue = toMinutes(c.rescueTime);
    if (rescue !== null && inQuiet(rescue, qs, qe)) errors.rescueTime = "Phải nằm ngoài giờ yên tĩnh (trước giờ bắt đầu yên tĩnh).";
    const weekly = toMinutes(c.weeklyTime);
    if (weekly !== null && inQuiet(weekly, qs, qe)) errors.weeklyTime = "Đang nằm trong giờ yên tĩnh.";
    const freeze = toMinutes(c.freezeNoticeTime);
    if (freeze !== null && inQuiet(freeze, qs, qe)) errors.freezeNoticeTime = "Đang nằm trong giờ yên tĩnh.";
  }
  if (c.rescueMinStreak < 1 || c.rescueMinStreak > LIMITS.maxRescueMinStreak) errors.rescueMinStreak = `Từ 1 đến ${LIMITS.maxRescueMinStreak} ngày.`;
  if (c.comebackDaysPush.length > LIMITS.maxComebackEntries) errors.comebackDaysPush = `Tối đa ${LIMITS.maxComebackEntries} mốc.`;
  return errors;
}
