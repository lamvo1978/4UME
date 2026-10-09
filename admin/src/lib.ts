import { notifications } from "@mantine/notifications";
import type { ImportStatus } from "./api";

/** Browser text-to-speech, close to what the app's expo-speech produces. */
export function speak(text: string) {
  if (!("speechSynthesis" in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export function notifyError(e: unknown) {
  notifications.show({ color: "red", title: "Lỗi", message: e instanceof Error ? e.message : String(e) });
}

export function notifySaved(message = "Đã lưu") {
  notifications.show({ color: "brand", message });
}

export const IMPORT_STATUS: Record<ImportStatus, { label: string; color: string }> = {
  create: { label: "Thêm mới", color: "green" },
  update: { label: "Cập nhật", color: "blue" },
  unchanged: { label: "Không đổi", color: "gray" },
  duplicate: { label: "Đã có", color: "orange" },
  error: { label: "Lỗi", color: "red" },
};

/** "vừa xong", "5 phút trước", "3 giờ trước", then a full date. */
export function timeAgo(iso: string) {
  const at = new Date(iso);
  const minutes = Math.floor((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ trước`;
  return fullTime(iso);
}

export const fullTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Local calendar key "yyyy-mm-dd", matching the server's DateOnly JSON. */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Days between a "yyyy-mm-dd" date and today (local). */
export function daysSince(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

/** "hôm nay", "hôm qua", "5 ngày trước" or "chưa học". */
export function studyAgo(date: string | null) {
  if (!date) return "chưa học";
  const n = daysSince(date);
  if (n <= 0) return "hôm nay";
  if (n === 1) return "hôm qua";
  return `${n} ngày trước`;
}

/** Ionicons glyph preview; the app renders the same glyph via @expo/vector-icons. */
export const ioniconSrc = (name: string) => `https://unpkg.com/ionicons@7.4.0/dist/svg/${name}.svg`;

const POS_VI: Record<string, string> = {
  noun: "danh từ",
  verb: "động từ",
  adjective: "tính từ",
  adverb: "trạng từ",
  preposition: "giới từ",
  pronoun: "đại từ",
  determiner: "hạn định từ",
  conjunction: "liên từ",
  interjection: "thán từ",
  number: "số từ",
};

/** "noun (danh từ)": the English term is what the app shows, the Vietnamese one helps editors. */
export const posLabel = (pos: string) => (POS_VI[pos] ? `${pos} (${POS_VI[pos]})` : pos);

/** Mirrors the app's exercise rules (mobile/src/screens/ReviewScreen.tsx). */
export function exerciseWarnings(w: { word: string; example: string; exampleVi: string; ipa: string; imageUrl: string | null }) {
  const warnings: string[] = [];
  const letters = w.word.replace(/[^a-zA-Z]/g, "").length;
  if (letters < 3 || letters > 12) warnings.push(`Từ có ${letters} chữ cái (cần 3–12): không có bài ráp chữ.`);
  const exampleWords = w.example.trim().split(/\s+/).filter(Boolean).length;
  if (!w.example.trim()) warnings.push("Chưa có câu ví dụ: không có bài xếp câu, thẻ học thiếu ví dụ.");
  else if (exampleWords < 3 || exampleWords > 10) warnings.push(`Câu ví dụ có ${exampleWords} từ (cần 3–10): không có bài xếp câu.`);
  if (w.example.trim() && !w.exampleVi.trim()) warnings.push("Thiếu nghĩa tiếng Việt của câu ví dụ.");
  if (!w.ipa.trim()) warnings.push("Thiếu phiên âm.");
  if (!w.imageUrl) warnings.push("Chưa có hình: không có bài chọn theo hình.");
  return warnings;
}
