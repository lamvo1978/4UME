import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type AvatarGroup = "people" | "zodiac" | "friends";

/** Built-in pictures; the key is what the server stores, so never rename one. */
export const AVATARS: { key: string; label: string; group: AvatarGroup; source: ImageSourcePropType }[] = [
  { key: "girl", label: "Cô gái", group: "people", source: require("../../assets/avatars/girl.jpg") },
  { key: "boy", label: "Chàng trai", group: "people", source: require("../../assets/avatars/boy.jpg") },
  { key: "woman", label: "Phụ nữ", group: "people", source: require("../../assets/avatars/woman.jpg") },
  { key: "man", label: "Đàn ông", group: "people", source: require("../../assets/avatars/man.jpg") },
  { key: "rat", label: "Tý", group: "zodiac", source: require("../../assets/avatars/rat.jpg") },
  { key: "buffalo", label: "Sửu", group: "zodiac", source: require("../../assets/avatars/buffalo.jpg") },
  { key: "tiger", label: "Dần", group: "zodiac", source: require("../../assets/avatars/tiger.jpg") },
  { key: "cat", label: "Mão", group: "zodiac", source: require("../../assets/avatars/cat.jpg") },
  { key: "dragon", label: "Thìn", group: "zodiac", source: require("../../assets/avatars/dragon.jpg") },
  { key: "snake", label: "Tỵ", group: "zodiac", source: require("../../assets/avatars/snake.jpg") },
  { key: "horse", label: "Ngọ", group: "zodiac", source: require("../../assets/avatars/horse.jpg") },
  { key: "goat", label: "Mùi", group: "zodiac", source: require("../../assets/avatars/goat.jpg") },
  { key: "monkey", label: "Thân", group: "zodiac", source: require("../../assets/avatars/monkey.jpg") },
  { key: "rooster", label: "Dậu", group: "zodiac", source: require("../../assets/avatars/rooster.jpg") },
  { key: "dog", label: "Tuất", group: "zodiac", source: require("../../assets/avatars/dog.jpg") },
  { key: "pig", label: "Hợi", group: "zodiac", source: require("../../assets/avatars/pig.jpg") },
  { key: "fox", label: "Cáo", group: "friends", source: require("../../assets/avatars/fox.jpg") },
  { key: "panda", label: "Gấu trúc", group: "friends", source: require("../../assets/avatars/panda.jpg") },
  { key: "rabbit", label: "Thỏ", group: "friends", source: require("../../assets/avatars/rabbit.jpg") },
  { key: "bear", label: "Gấu", group: "friends", source: require("../../assets/avatars/bear.jpg") },
  { key: "penguin", label: "Chim cánh cụt", group: "friends", source: require("../../assets/avatars/penguin.jpg") },
  { key: "owl", label: "Cú", group: "friends", source: require("../../assets/avatars/owl.jpg") },
  { key: "elephant", label: "Voi", group: "friends", source: require("../../assets/avatars/elephant.jpg") },
  { key: "koala", label: "Koala", group: "friends", source: require("../../assets/avatars/koala.jpg") },
];

export const AVATAR_GROUPS: { group: AvatarGroup; title: string }[] = [
  { group: "people", title: "Con người" },
  { group: "zodiac", title: "12 con giáp" },
  { group: "friends", title: "Bạn thú" },
];

export function avatarSource(key?: string | null) {
  return key ? AVATARS.find((a) => a.key === key)?.source : undefined;
}

/** The chosen picture, or the name's initial when none is set (or the key is from a newer app). */
export function Avatar({
  name,
  avatar,
  size = 44,
  ring,
}: {
  name?: string;
  avatar?: string | null;
  size?: number;
  /** Border colour, e.g. gold for Premium. */
  ring?: string;
}) {
  const source = avatarSource(avatar);
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  const border = ring ? { borderColor: ring, borderWidth: Math.max(2, Math.round(size / 22)) } : null;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, border]}>
      {source ? (
        <Image source={source} style={styles.image} />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  initial: { color: colors.accent, fontWeight: "700" },
});
