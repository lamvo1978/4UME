import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, PronunciationStatus } from "../api/client";
import { scoreColor, scoreSoft, verdict } from "../components/SpeakExercise";
import { colors, fonts, shadow, spacing } from "../theme";
import { formatDayMonthYear } from "../utils/dates";

const DAY_MS = 86_400_000;

/** Illustration only: what a detailed check looks like for a word with one weak sound. */
const SAMPLE = {
  word: "thought",
  score: 71,
  phonemes: [
    { phoneme: "θ", score: 38 },
    { phoneme: "ɔ", score: 86 },
    { phoneme: "t", score: 94 },
  ],
};

const ALWAYS_FREE: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }[] = [
  { icon: "book-outline", text: "Học từ vựng A1–B2 và toàn bộ bài ngữ pháp" },
  { icon: "repeat-outline", text: "Ôn tập cách quãng, chuỗi ngày học" },
  { icon: "headset-outline", text: "Luyện nghe hội thoại, câu chuyện" },
  { icon: "mic-outline", text: "Ghi âm và tự so sánh với giọng mẫu, không giới hạn" },
];

export function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PronunciationStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .pronunciationStatus()
      .then(setStatus)
      .catch(() => setFailed(true));
  }, []);

  if (!status) {
    return (
      <View style={[styles.root, styles.center]}>
        {failed ? (
          <Text style={styles.muted}>Không tải được thông tin gói. Bạn thử lại sau nhé.</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const premium = status.premium && !!status.premiumUntil;
  const daysLeft = premium ? Math.max(1, Math.ceil((new Date(status.premiumUntil!).getTime() - Date.now()) / DAY_MS)) : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={28} color={colors.white} />
        </View>
        <Text style={styles.brand}>4UME Premium</Text>
        <Text style={styles.headline}>Biết chính xác âm nào bạn đọc sai</Text>
        <Text style={styles.lead}>Mỗi lần nói, 4UME chấm điểm từng âm và chỉ ra âm cần luyện, để bạn sửa đúng chỗ.</Text>
      </View>

      {premium ? (
        <View style={styles.current}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          <Text style={styles.currentText}>
            Bạn đang dùng Premium đến {formatDayMonthYear(status.premiumUntil!)} · còn {daysLeft} ngày
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Ví dụ kết quả chấm</Text>
      <View style={styles.card}>
        <View style={styles.sampleHead}>
          <View style={[styles.ring, { borderColor: scoreColor(SAMPLE.score) }]}>
            <Text style={[styles.ringValue, { color: scoreColor(SAMPLE.score) }]}>{SAMPLE.score}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.sampleWord}>{SAMPLE.word}</Text>
            <Text style={[styles.verdict, { color: scoreColor(SAMPLE.score) }]}>{verdict(SAMPLE.score)}</Text>
          </View>
        </View>
        <View style={styles.phonemes}>
          {SAMPLE.phonemes.map((p) => (
            <View key={p.phoneme} style={[styles.phoneme, { backgroundColor: scoreSoft(p.score) }]}>
              <Text style={[styles.phonemeText, { color: scoreColor(p.score) }]}>/{p.phoneme}/</Text>
              <Text style={[styles.phonemeScore, { color: scoreColor(p.score) }]}>{p.score}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.tip}>Âm /θ/ chưa chuẩn (38 điểm). Nghe lại giọng mẫu và chú ý âm này.</Text>
      </View>

      <Text style={styles.sectionTitle}>Lượt chấm chi tiết mỗi ngày</Text>
      <View style={styles.plans}>
        <View style={[styles.plan, !premium && styles.planCurrent]}>
          <Text style={styles.planName}>Miễn phí</Text>
          <Text style={styles.planValue}>{status.freeDailyLimit}</Text>
          <Text style={styles.planUnit}>lượt / ngày</Text>
          {!premium ? <Text style={styles.badge}>Gói hiện tại</Text> : null}
        </View>
        <View style={[styles.plan, styles.planPremium]}>
          <Text style={[styles.planName, styles.planNamePremium]}>Premium</Text>
          <Text style={[styles.planValue, styles.planValuePremium]}>{status.premiumDailyLimit}</Text>
          <Text style={styles.planUnit}>lượt / ngày</Text>
          {premium ? <Text style={styles.badge}>Gói hiện tại</Text> : null}
        </View>
      </View>
      {status.enabled ? (
        <Text style={styles.usage}>
          Hôm nay còn {status.remaining}/{status.dailyLimit} lượt chấm chi tiết.
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Luôn miễn phí cho mọi người</Text>
      <View style={styles.card}>
        {ALWAYS_FREE.map((f) => (
          <View key={f.text} style={styles.freeRow}>
            <Ionicons name={f.icon} size={18} color={colors.accent} />
            <Text style={styles.freeText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {!premium ? (
        <View style={styles.soon}>
          <Ionicons name="time-outline" size={18} color={colors.muted} />
          <Text style={styles.soonText}>Đăng ký Premium ngay trong app sẽ có ở bản cập nhật tới.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  muted: { color: colors.muted, textAlign: "center" },
  content: { padding: spacing.lg, paddingTop: spacing.md },
  hero: { alignItems: "center", gap: 6 },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brand: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: colors.accent },
  headline: { fontSize: 20, fontWeight: "800", color: colors.ink, textAlign: "center" },
  lead: { fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: "center" },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  currentText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  sampleHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 20, fontWeight: "800" },
  sampleWord: { fontSize: 22, fontWeight: "800", color: colors.ink },
  verdict: { fontSize: 15, fontWeight: "700" },
  phonemes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  phoneme: { alignItems: "center", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  phonemeText: { fontSize: 17, fontWeight: "700" },
  phonemeScore: { fontSize: 12, fontWeight: "700" },
  tip: { fontSize: 14, lineHeight: 20, color: colors.ink },
  plans: { flexDirection: "row", gap: spacing.sm },
  plan: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...shadow.card,
  },
  planCurrent: { borderColor: colors.border },
  planPremium: { borderColor: colors.gold },
  planName: { fontSize: 14, fontWeight: "700", color: colors.muted },
  planNamePremium: { color: colors.ink },
  planValue: { marginTop: 4, fontSize: 34, fontWeight: "800", color: colors.muted },
  planValuePremium: { color: colors.accent },
  planUnit: { fontSize: 13, color: colors.muted },
  badge: {
    marginTop: spacing.xs,
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  usage: { marginTop: spacing.sm, fontSize: 13, color: colors.ink, textAlign: "center" },
  freeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  freeText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  soon: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  soonText: { flex: 1, fontSize: 13, color: colors.muted },
});
