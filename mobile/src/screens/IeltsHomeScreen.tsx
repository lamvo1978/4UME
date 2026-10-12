import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, shadow, spacing } from "../theme";

const SKILLS: { icon: ComponentProps<typeof Ionicons>["name"]; title: string; body: string }[] = [
  { icon: "headset-outline", title: "Listening", body: "Luyện nghe theo dạng đề, có chép chính tả." },
  { icon: "book-outline", title: "Reading", body: "Đọc hiểu với từ vựng học thuật theo chủ đề." },
  { icon: "create-outline", title: "Writing", body: "Bố cục và mẫu câu cho Task 1, Task 2." },
  { icon: "mic-outline", title: "Speaking", body: "Trả lời Part 1–3, chấm phát âm từng âm." },
];

/** IELTS section for partner students; content arrives later, for now it shows what is coming. */
export function IeltsHomeScreen() {
  const { me } = useAuth();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons name="school" size={26} color={colors.white} />
        <Text style={styles.heroTitle}>IELTS</Text>
        <Text style={styles.heroSub}>
          {me?.partnerName ? `Dành riêng cho học viên ${me.partnerName}. ` : ""}Nội dung đang được chuẩn bị, bài mới sẽ hiện ngay tại đây.
        </Text>
      </View>
      {SKILLS.map((s) => (
        <View key={s.title} style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name={s.icon} size={18} color={colors.accent} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
          <Text style={styles.soon}>Sắp có</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    padding: spacing.lg,
    gap: 6,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  heroTitle: { fontSize: 26, fontWeight: "800", color: colors.white },
  heroSub: { fontSize: 14, lineHeight: 20, color: colors.white, opacity: 0.9 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    opacity: 0.85,
    ...shadow.card,
  },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  body: { marginTop: 2, fontSize: 13, color: colors.muted },
  soon: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: "hidden",
  },
});
