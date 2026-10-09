import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps } from "react";
import { ListeningKind } from "../api/client";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const KIND_META: Record<ListeningKind, { label: string; icon: IconName }> = {
  dialogue: { label: "Hội thoại", icon: "chatbubbles-outline" },
  story: { label: "Câu chuyện", icon: "book-outline" },
  news: { label: "Bản tin", icon: "newspaper-outline" },
};

export const SPEEDS = [0.75, 1, 1.25] as const;

/** What the script shows while listening. */
export type ScriptMode = "both" | "en" | "hidden";
export const SCRIPT_MODES: { key: ScriptMode; label: string }[] = [
  { key: "both", label: "Anh + Việt" },
  { key: "en", label: "Chỉ tiếng Anh" },
  { key: "hidden", label: "Ẩn script" },
];

export function formatClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Splits a sentence into words and the spaces/punctuation between them, so words can be long-pressed. */
export function tokenize(text: string): { text: string; word: string | null }[] {
  const parts = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*|[^A-Za-z]+/g) ?? [text];
  return parts.map((p) => ({ text: p, word: /^[A-Za-z]/.test(p) ? p.replace(/['’]s$/i, "").toLowerCase() : null }));
}
