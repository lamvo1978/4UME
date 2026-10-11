import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ComponentProps, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adsOffered, watchRewardedAd } from "../ads/rewarded";
import { api, PronunciationStatus } from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";

/** Free learners stock up on today's pronunciation checks by choosing to watch rewarded ads, one check each. */
export function AdRewardsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<PronunciationStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [watching, setWatching] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .pronunciationStatus()
      .then(setStatus)
      .catch(() => setFailed(true));
  }, []);

  async function watch() {
    if (!status) return;
    setWatching(true);
    setMessage(null);
    try {
      const next = await watchRewardedAd();
      const earned = next.adsWatchedToday > status.adsWatchedToday;
      setStatus(next);
      setMessage(
        earned
          ? { ok: true, text: `Đã thêm 1 lượt. Hôm nay bạn còn ${next.remaining} lượt chấm.` }
          : { ok: false, text: "Lượt này chưa được tính, bạn thử lại sau nhé." },
      );
    } catch {
      setMessage({ ok: false, text: "Chưa tải được quảng cáo, bạn thử lại sau nhé." });
    } finally {
      setWatching(false);
    }
  }

  if (!status) {
    return (
      <View style={[styles.root, styles.center]}>
        {failed ? (
          <Text style={styles.muted}>Không tải được số lượt. Bạn thử lại sau nhé.</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const premium = status.premium;
  if (!adsOffered(status)) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>
          {premium ? "Tài khoản Premium không có quảng cáo." : "Hiện chưa thể xem quảng cáo để thêm lượt. Bạn quay lại sau nhé."}
        </Text>
      </View>
    );
  }

  const done = status.adsLeftToday === 0;
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Lượt chấm phát âm còn hôm nay</Text>
        <Text style={styles.heroValue}>{status.remaining}</Text>
        <Text style={styles.heroSub}>
          {status.freeDailyLimit} lượt miễn phí
          {status.adsWatchedToday > 0 ? ` + ${status.adsWatchedToday} lượt từ quảng cáo` : ""} · đã dùng {status.usedToday}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Quảng cáo đã xem hôm nay</Text>
          <Text style={styles.count}>
            {status.adsWatchedToday}/{status.adsDailyLimit}
          </Text>
        </View>
        <View style={styles.dots}>
          {Array.from({ length: status.adsDailyLimit }, (_, i) => (
            <View key={i} style={[styles.dot, i < status.adsWatchedToday && styles.dotOn]} />
          ))}
        </View>

        <Pressable
          disabled={watching || done}
          onPress={watch}
          style={({ pressed }) => [styles.button, done && styles.buttonDone, (pressed || watching) && styles.pressed]}
        >
          {watching ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name={done ? "checkmark-circle" : "play-circle"} size={22} color={done ? colors.muted : colors.white} />
          )}
          <Text style={[styles.buttonText, done && styles.buttonTextDone]}>
            {done ? "Đã xem đủ hôm nay" : "Xem quảng cáo +1 lượt"}
          </Text>
        </Pressable>
        {message ? <Text style={[styles.message, !message.ok && styles.messageError]}>{message.text}</Text> : null}
        {done ? <Text style={styles.hint}>Ngày mai bạn lại xem được {status.adsDailyLimit} quảng cáo.</Text> : null}
      </View>

      <View style={styles.notes}>
        <Note icon="hand-left-outline" text="Không bắt buộc. Không xem thì bạn vẫn luyện đọc bằng cách tự so sánh giọng." />
        <Note icon="play-outline" text="Xem hết một quảng cáo được 1 lượt chấm. Đóng giữa chừng thì không tính." />
        <Note icon="time-outline" text="Lượt thêm chỉ dùng trong hôm nay, qua ngày mới sẽ không còn." />
        <Note icon="mic-outline" text="Mỗi lần chấm, kể cả đọc lại cùng một từ, dùng 1 lượt." />
      </View>

      <Pressable
        onPress={() => navigation.navigate("Premium")}
        hitSlop={8}
        style={({ pressed }) => [styles.premiumLink, pressed && styles.pressed]}
      >
        <Ionicons name="sparkles" size={14} color={colors.accent} />
        <Text style={styles.premiumLinkText}>Premium: {status.premiumDailyLimit} lượt mỗi ngày, không quảng cáo</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accent} />
      </Pressable>
    </ScrollView>
  );
}

function Note({ icon, text }: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={styles.note}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  muted: { color: colors.muted, textAlign: "center", fontSize: 15, lineHeight: 21 },
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  hero: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  heroLabel: { fontSize: 14, fontWeight: "700", color: colors.white, opacity: 0.85 },
  heroValue: { fontSize: 56, fontWeight: "800", color: colors.white, lineHeight: 64 },
  heroSub: { fontSize: 13, color: colors.white, opacity: 0.85, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.md, ...shadow.card },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  count: { fontSize: 16, fontWeight: "800", color: colors.accent },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dot: { width: 22, height: 8, borderRadius: 4, backgroundColor: colors.bgAlt },
  dotOn: { backgroundColor: colors.accent },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 16,
  },
  buttonDone: { backgroundColor: colors.bgAlt },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  buttonTextDone: { color: colors.muted },
  message: { fontSize: 14, fontWeight: "600", color: colors.accent, textAlign: "center" },
  messageError: { color: colors.danger },
  hint: { fontSize: 13, color: colors.muted, textAlign: "center" },
  notes: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.muted },
  premiumLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: colors.accentSoft,
  },
  premiumLinkText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  pressed: { opacity: 0.7 },
});
