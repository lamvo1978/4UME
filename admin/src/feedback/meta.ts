import type { FeedbackCategory, FeedbackStatus } from "../api";

/** No push to the browser yet, so feedback pages and the menu badge poll. */
export const FEEDBACK_POLL_MS = 30_000;

export const CATEGORIES: { value: FeedbackCategory; label: string; color: string }[] = [
  { value: "idea", label: "Góp ý", color: "teal" },
  { value: "bug", label: "Báo lỗi", color: "red" },
  { value: "content", label: "Nội dung sai", color: "orange" },
  { value: "other", label: "Khác", color: "gray" },
];

export const categoryMeta = (c: string) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[3];

export const STATUSES: Record<FeedbackStatus, { label: string; color: string }> = {
  open: { label: "Chờ trả lời", color: "yellow" },
  answered: { label: "Đã trả lời", color: "blue" },
  closed: { label: "Đã đóng", color: "gray" },
};

export const CLOSED_BY: Record<string, string> = {
  user: "Người dùng bấm Đã giải quyết",
  admin: "Quản trị viên đóng",
  auto: "Tự đóng vì lâu không phản hồi",
};
