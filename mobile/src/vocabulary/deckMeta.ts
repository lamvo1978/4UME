import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps } from "react";
import { Deck } from "../api/client";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Deck icons and order come from the server (editable in the web admin); unknown glyphs fall back. */
export function deckIcon(deck: Pick<Deck, "icon">): IconName {
  return deck.icon in Ionicons.glyphMap ? (deck.icon as IconName) : "albums-outline";
}

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

/** "noun" -> "noun (danh từ)" */
export const posLabel = (pos: string) => (POS_VI[pos] ? `${pos} (${POS_VI[pos]})` : pos);

/** "A1,A2,B1" -> "A1–B1" */
export function levelRange(levels: string | null): string {
  const list = (levels ?? "").split(",").map((l) => l.trim()).filter(Boolean).sort();
  if (list.length === 0) return "";
  return list.length === 1 ? list[0] : `${list[0]}–${list[list.length - 1]}`;
}
