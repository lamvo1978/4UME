import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, PremiumPerk, PronunciationStatus } from "../api/client";
import { scoreColor, scoreSoft, verdict } from "../components/SpeakExercise";
import { colors, shadow, spacing } from "../theme";
import { formatDayMonthYear } from "../utils/dates";

const DAY_MS = 86_400_000;

/** Illustration only: what a detailed check looks like for a word with one weak sound. */
const SAMPLE = {
  word: "thought",
  ipa: "/θɔt/",
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

const perkIcon = (name: string): ComponentProps<typeof Ionicons>["name"] =>
  name in Ionicons.glyphMap ? (name as ComponentProps<typeof Ionicons>["name"]) : "sparkles-outline";

export function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PronunciationStatus | null>(null);
  const [perks, setPerks] = useState<PremiumPerk[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .pronunciationStatus()
      .then(setStatus)
      .catch(() => setFailed(true));
    api
      .premiumPerks()
      .then(setPerks)
      .catch(() => setPerks([]));
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
  const usage = status.enabled ? `Hôm nay còn ${status.remaining}/${status.dailyLimit}` : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={22} color={colors.accent} />
        </View>
        <Text style={styles.headline}>{"Biết chính xác\nâm nào bạn đọc sai"}</Text>
        <Text style={styles.lead}>Mỗi lần nói, 4UME chấm điểm từng âm và chỉ ra âm cần luyện, để bạn sửa đúng chỗ.</Text>
        {premium ? (
          <View style={styles.heroStatus}>
            <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
            <Text style={styles.heroStatusText}>
              Đang dùng đến {formatDayMonthYear(status.premiumUntil!)} · còn {daysLeft} ngày
            </Text>
          </View>
        ) : null}
      </View>

      {perks.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, styles.sectionGap]}>Quyền lợi Premium</Text>
          <View style={styles.card}>
            {perks.map((perk, i) => (
              <View key={`${perk.title}-${i}`} style={[styles.perkRow, i > 0 && styles.freeRowBorder]}>
                <View style={styles.perkIcon}>
                  <Ionicons name={perkIcon(perk.icon)} size={18} color={colors.accent} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.perkHead}>
                    <Text style={styles.perkTitle}>{perk.title.replace("{n}", String(status.premiumDailyLimit))}</Text>
                    {perk.soon ? <Text style={styles.soonTag}>Sắp có</Text> : null}
                  </View>
                  {perk.body ? <Text style={styles.perkBody}>{perk.body}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Kết quả chấm trông thế này</Text>
        <Text style={styles.sampleTag}>Ví dụ</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.sampleHead}>
          <View style={[styles.ring, { borderColor: scoreColor(SAMPLE.score) }]}>
            <Text style={[styles.ringValue, { color: scoreColor(SAMPLE.score) }]}>{SAMPLE.score}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.sampleWord}>
              {SAMPLE.word} <Text style={styles.sampleIpa}>{SAMPLE.ipa}</Text>
            </Text>
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
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={16} color={colors.flameDeep} />
          <Text style={styles.tipText}>Âm /θ/ chưa chuẩn (38 điểm). Nghe lại giọng mẫu và chú ý âm này.</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, styles.sectionGap]}>Lượt chấm chi tiết mỗi ngày</Text>
      <View style={styles.plans}>
        <PlanTile
          name="Miễn phí"
          value={status.freeDailyLimit}
          current={!premium}
          footer={!premium ? usage : null}
        />
        <PlanTile
          name="Premium"
          value={status.premiumDailyLimit}
          current={premium}
          highlight
          footer={premium ? usage : null}
          note={premium ? null : "Sắp mở đăng ký"}
        />
      </View>

      <Text style={[styles.sectionTitle, styles.sectionGap]}>Luôn miễn phí cho mọi người</Text>
      <View style={styles.card}>
        {ALWAYS_FREE.map((f, i) => (
          <View key={f.text} style={[styles.freeRow, i > 0 && styles.freeRowBorder]}>
            <View style={styles.freeIcon}>
              <Ionicons name={f.icon} size={16} color={colors.accent} />
            </View>
            <Text style={styles.freeText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {!premium ? <Text style={styles.soon}>Đăng ký Premium ngay trong app sẽ có ở bản cập nhật tới.</Text> : null}
    </ScrollView>
  );
}

function PlanTile({
  name,
  value,
  current,
  highlight,
  footer,
  note,
}: {
  name: string;
  value: number;
  current: boolean;
  highlight?: boolean;
  footer: string | null;
  note?: string | null;
}) {
  return (
    <View style={[styles.plan, highlight && styles.planPremium]}>
      <View style={styles.planTop}>
        {highlight ? <Ionicons name="sparkles" size={14} color={colors.gold} /> : null}
        <Text style={[styles.planName, highlight && styles.planNamePremium]}>{name}</Text>
      </View>
      <Text style={[styles.planValue, highlight && styles.planValuePremium]}>{value}</Text>
      <Text style={styles.planUnit}>lượt / ngày</Text>
      <View style={styles.planFoot}>
        {current ? <Text style={styles.badge}>Gói hiện tại</Text> : note ? <Text style={styles.badgeMuted}>{note}</Text> : null}
        {footer ? <Text style={styles.planUsage}>{footer}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  muted: { color: colors.muted, textAlign: "center" },
  content: { padding: spacing.lg, paddingTop: spacing.md },
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  headline: { fontSize: 21, lineHeight: 28, fontWeight: "800", color: colors.white, textAlign: "center" },
  lead: { fontSize: 14, lineHeight: 20, color: colors.white, opacity: 0.85, textAlign: "center" },
  heroStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  heroStatusText: { fontSize: 13, fontWeight: "700", color: colors.white },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  sectionGap: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sampleTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  sampleHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 20, fontWeight: "800" },
  sampleWord: { fontSize: 22, fontWeight: "800", color: colors.ink },
  sampleIpa: { fontSize: 17, fontWeight: "500", color: colors.muted },
  verdict: { fontSize: 15, fontWeight: "700" },
  phonemes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  phoneme: { alignItems: "center", minWidth: 52, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  phonemeText: { fontSize: 17, fontWeight: "700" },
  phonemeScore: { fontSize: 12, fontWeight: "700" },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.flameSoft,
  },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  plans: { flexDirection: "row", gap: spacing.sm },
  plan: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.card,
  },
  planPremium: { borderColor: colors.gold },
  planTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  planName: { fontSize: 14, fontWeight: "700", color: colors.muted },
  planNamePremium: { color: colors.ink },
  planValue: { marginTop: 2, fontSize: 36, fontWeight: "800", color: colors.muted },
  planValuePremium: { color: colors.accent },
  planUnit: { fontSize: 13, color: colors.muted },
  planFoot: { alignItems: "center", gap: 4, marginTop: spacing.sm, minHeight: 40 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  badgeMuted: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planUsage: { fontSize: 12, color: colors.ink },
  freeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs },
  freeRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  freeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  freeText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  perkRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingTop: spacing.xs },
  perkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.flameSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  perkHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  perkTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  perkBody: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.muted },
  soonTag: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.flameDeep,
    borderWidth: 1,
    borderColor: colors.flame,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  soon: { marginTop: spacing.lg, fontSize: 12, color: colors.muted, textAlign: "center" },
});
