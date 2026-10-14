import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

/** Built-in pictures; the key is what the server stores, so never rename one. */
export const AVATARS: { key: string; label: string; source: ImageSourcePropType }[] = [
  { key: "girl", label: "Cô gái", source: require("../../assets/avatars/girl.jpg") },
  { key: "boy", label: "Chàng trai", source: require("../../assets/avatars/boy.jpg") },
  { key: "woman", label: "Phụ nữ", source: require("../../assets/avatars/woman.jpg") },
  { key: "man", label: "Đàn ông", source: require("../../assets/avatars/man.jpg") },
  { key: "cat", label: "Mèo", source: require("../../assets/avatars/cat.jpg") },
  { key: "dog", label: "Cún", source: require("../../assets/avatars/dog.jpg") },
  { key: "fox", label: "Cáo", source: require("../../assets/avatars/fox.jpg") },
  { key: "panda", label: "Gấu trúc", source: require("../../assets/avatars/panda.jpg") },
  { key: "rabbit", label: "Thỏ", source: require("../../assets/avatars/rabbit.jpg") },
  { key: "bear", label: "Gấu", source: require("../../assets/avatars/bear.jpg") },
  { key: "penguin", label: "Chim cánh cụt", source: require("../../assets/avatars/penguin.jpg") },
  { key: "owl", label: "Cú", source: require("../../assets/avatars/owl.jpg") },
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
