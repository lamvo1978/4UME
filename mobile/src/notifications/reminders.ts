import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Me, NotificationConfig, ReviewForecastDay } from "../api/client";
import { addDays, toDayKey } from "../utils/dates";
import {
  comebackContent,
  Content,
  dueTitle,
  encouragementTitle,
  newWordsTitle,
  rescueContent,
  streakLine,
} from "./copy";

const DAYS_AHEAD = 7;
const CHANNEL_ID = "study-reminder";

/** Tab opened when the user taps a reminder. */
export type ReminderScreen = "practice" | "study";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function inQuietHours(minutes: number, config: NotificationConfig) {
  const start = toMinutes(config.quietStart);
  const end = toMinutes(config.quietEnd);
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function dayNumber(date: Date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function at(day: Date, minutes: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

type Planned = { date: Date; content: Content; screen: ReminderScreen };

/**
 * Builds the next week of local reminders assuming the user does not study until then;
 * the schedule is rebuilt whenever /api/me changes, so studying drops the stale ones.
 */
export function planReminders(me: Me, config: NotificationConfig, forecast: ReviewForecastDay[], now = new Date()) {
  const s = me.settings;
  const studied = me.studiedToday ? 1 : 0;
  const dailyMinutes = inQuietHours(toMinutes(s.reminderTime), config)
    ? toMinutes(config.quietEnd)
    : toMinutes(s.reminderTime);
  const rescueMinutes = toMinutes(config.rescueTime);
  const rescueAllowed =
    s.notifyRescue &&
    config.maxPerDay >= 2 &&
    !inQuietHours(rescueMinutes, config) &&
    !(s.reminderEnabled && dailyMinutes >= rescueMinutes);
  const hoursLeft = Math.floor((24 * 60 - rescueMinutes) / 60);
  const lastStudy = me.lastStudyDate ? dayNumber(new Date(`${me.lastStudyDate}T00:00:00`)) : null;
  const byDate = new Map(forecast.map((f) => [f.date, f]));

  const planned: Planned[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = 0; d < DAYS_AHEAD; d++) {
    if (d === 0 && me.studiedToday) continue;
    const day = addDays(today, d);
    const seed = dayNumber(day);
    const due = byDate.get(toDayKey(day)) ?? { words: 0, grammar: 0 };
    const dueTotal = due.words + due.grammar;

    // Days missed before this one, if nothing is studied in between.
    const missed = d - studied;
    const alive = me.streak > 0 && missed <= me.streakFreezes;
    const streakToKeep = alive ? me.streak + missed : 0;
    const daysAway = lastStudy === null ? null : seed - lastStudy;

    if (s.reminderEnabled) {
      let content: Content;
      let screen: ReminderScreen;
      if (!alive && daysAway !== null && config.comebackDaysLocal.includes(daysAway)) {
        content = comebackContent(daysAway, due.words, seed);
        screen = dueTotal > 0 ? "practice" : "study";
      } else {
        const newLeft = d === 0 ? Math.max(0, s.dailyGoal - me.todayNewWords) : s.dailyGoal;
        const title =
          dueTotal > 0
            ? dueTitle(due.words, due.grammar, seed)
            : newLeft > 0
              ? newWordsTitle(newLeft, seed)
              : encouragementTitle(seed);
        content = { title, body: streakLine(streakToKeep, me.nextMilestone, seed) };
        screen = dueTotal > 0 ? "practice" : "study";
      }
      planned.push({ date: at(day, dailyMinutes), content, screen });
    }

    if (rescueAllowed && alive && streakToKeep >= config.rescueMinStreak) {
      planned.push({
        date: at(day, rescueMinutes),
        content: rescueContent({ streak: streakToKeep, hoursLeft, freezesLeft: me.streakFreezes - missed, seed }),
        screen: dueTotal > 0 ? "practice" : "study",
      });
    }
  }
  return planned.filter((p) => p.date > now);
}

/** Replaces every scheduled reminder; pass null to clear them (e.g. on logout). */
export async function syncReminders(
  input: { me: Me; config: NotificationConfig; forecast: ReviewForecastDay[] } | null
) {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!input) return;

  const planned = planReminders(input.me, input.config, input.forecast);
  if (planned.length === 0) return;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Nhắc học",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      content: { ...p.content, data: { screen: p.screen } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL_ID },
    });
  }
}

function screenOf(response: Notifications.NotificationResponse | null): ReminderScreen | null {
  const screen = response?.notification.request.content.data?.screen;
  return screen === "practice" || screen === "study" ? screen : null;
}

/** Calls `open` for reminder taps, including the one that launched the app. Returns an unsubscribe function. */
export function onReminderTap(open: (screen: ReminderScreen) => void) {
  if (Platform.OS === "web") return () => undefined;
  let active = true;
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const screen = screenOf(response);
      if (active && screen) {
        open(screen);
        Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
    })
    .catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = screenOf(response);
    if (screen) open(screen);
  });
  return () => {
    active = false;
    sub.remove();
  };
}
