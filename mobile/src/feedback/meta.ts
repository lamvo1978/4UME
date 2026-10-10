import Constants from "expo-constants";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import type { FeedbackCategory, FeedbackStatus } from "../api/client";
import { colors } from "../theme";

export const MAX_IMAGES = 3;
export const MAX_BODY = 2000;

export const CATEGORIES: { value: FeedbackCategory; label: string; hint: string }[] = [
  { value: "idea", label: "Góp ý", hint: "Ý tưởng, tính năng bạn muốn có…" },
  { value: "bug", label: "Báo lỗi", hint: "Bạn đang làm gì thì lỗi xảy ra? Màn nào?" },
  { value: "content", label: "Nội dung sai", hint: "Từ, nghĩa, phiên âm hay câu ví dụ nào bị sai?" },
  { value: "other", label: "Khác", hint: "Bạn muốn nhắn gì cho 4UME?" },
];

export const categoryLabel = (c: FeedbackCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? "Góp ý";

export const STATUS: Record<FeedbackStatus, { label: string; fg: string; bg: string }> = {
  open: { label: "Đang chờ 4UME", fg: colors.flameDeep, bg: colors.flameSoft },
  answered: { label: "4UME đã trả lời", fg: colors.accent, bg: colors.accentSoft },
  closed: { label: "Đã đóng", fg: colors.muted, bg: colors.bgAlt },
};

export const CLOSED_NOTE: Record<string, string> = {
  user: "Bạn đã đánh dấu góp ý này là đã giải quyết.",
  admin: "4UME đã đóng góp ý này.",
  auto: "Góp ý tự đóng vì một thời gian không có phản hồi thêm.",
};

/** Attached to every new ticket so bug reports say which build and phone they came from. */
export function deviceInfo() {
  return {
    appVersion: Constants.expoConfig?.version ?? "1.0.0",
    platform: `${Platform.OS} ${Platform.Version}`,
    device: [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "Không rõ",
  };
}

/** Screenshots from the photo library; null when the learner cancels. */
export async function pickImages(room: number): Promise<string[] | null> {
  if (room <= 0) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: room > 1,
    selectionLimit: room,
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets.slice(0, room).map((a) => a.uri);
}

export function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.getDate()}/${d.getMonth() + 1}${d.getFullYear() === now.getFullYear() ? "" : `/${d.getFullYear()}`} ${time}`;
}
