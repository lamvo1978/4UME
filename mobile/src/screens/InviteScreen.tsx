import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, MyReferral } from "../api/client";
import { formatDayMonthYear } from "../utils/dates";
import { useAuth } from "../auth/AuthContext";
import { colors, shadow, spacing } from "../theme";

/** The learner's invite code to share, friends they invited, and one box for invite or partner-centre codes. */
export function InviteScreen() {
  const insets = useSafeAreaInsets();
  const { me, refreshMe } = useAuth();
  const [data, setData] = useState<MyReferral | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api
      .referral()
      .then((r) => {
        setData(r);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.redeemCode(code);
      setMessage({ ok: true, text: result.message });
      setCode("");
      load();
      await refreshMe();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Chưa áp dụng được mã, bạn thử lại sau nhé." });
    } finally {
      setBusy(false);
    }
  }

  function share() {
    if (!data) return;
    Share.share({
      message:
        `Mình đang học tiếng Anh mỗi ngày với 4UME. Tải app rồi nhập mã ${data.code} ` +
        `(Hồ sơ → Mời bạn bè) để cả hai cùng nhận ${data.rewardDays} ngày Premium nhé: ${data.link}`,
    }).catch(() => {});
  }

  if (!data) {
    return (
      <View style={[styles.root, styles.center]}>
        {failed ? <Text style={styles.muted}>Không tải được mã mời. Bạn thử lại sau nhé.</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const left = Math.max(0, data.maxRewards - data.rewardsEarned);
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {me?.partnerName ? (
        <View style={styles.partner}>
          <Ionicons name="school" size={20} color={colors.white} />
          <View style={styles.flex}>
            <Text style={styles.partnerTitle}>Học viên {me.partnerName}</Text>
            <Text style={styles.partnerSub}>
              {me.partnerUntil ? `Tài khoản có Premium đến ${formatDayMonthYear(me.partnerUntil)}.` : "Tài khoản đang có Premium không thời hạn."}
            </Text>
          </View>
        </View>
      ) : null}

      {data.enabled ? (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Mã mời của bạn</Text>
          <Text style={styles.code} selectable>
            {data.code}
          </Text>
          <Text style={styles.heroSub}>
            Bạn bè học đủ {data.requiredStudyDays} ngày, cả hai cùng nhận {data.rewardDays} ngày Premium.
          </Text>
          <Pressable onPress={share} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
            <Ionicons name="share-social" size={18} color={colors.accent} />
            <Text style={styles.shareText}>Gửi mã cho bạn bè</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nhập mã</Text>
        <Text style={styles.cardSub}>
          {data.canEnterInviteCode ? "Mã mời của bạn bè hoặc mã do trung tâm Anh ngữ cấp." : "Mã do trung tâm Anh ngữ cấp cho học viên."}
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="VD: AB-K7P2X9"
            placeholderTextColor={colors.idle}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={redeem}
          />
          <Pressable
            onPress={redeem}
            disabled={busy || !code.trim()}
            style={({ pressed }) => [styles.applyButton, (!code.trim() || busy) && styles.applyDisabled, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.applyText}>Áp dụng</Text>}
          </Pressable>
        </View>
        {message ? <Text style={[styles.message, !message.ok && styles.messageError]}>{message.text}</Text> : null}
        {data.invitedBy ? <Text style={styles.hint}>Bạn tham gia qua lời mời của {data.invitedBy}.</Text> : null}
      </View>

      {data.enabled ? (
        <>
          <View style={styles.notes}>
            <Note icon="paper-plane-outline" text="Gửi mã hoặc đường dẫn cho bạn bè chưa dùng 4UME." />
            <Note
              icon="person-add-outline"
              text={`Bạn bè tạo tài khoản rồi nhập mã ở Hồ sơ → Mời bạn bè, trong ${data.joinWindowDays} ngày đầu.`}
            />
            <Note
              icon="gift-outline"
              text={`Khi bạn bè học đủ ${data.requiredStudyDays} ngày, mỗi người được cộng ${data.rewardDays} ngày Premium.`}
            />
            <Note
              icon="ribbon-outline"
              text={`Bạn nhận thưởng tối đa ${data.maxRewards} lần · đã nhận ${data.rewardsEarned}${left === 0 ? " (đã đủ)" : ""}.`}
            />
          </View>

          {data.invitees.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bạn bè đã mời</Text>
              {data.invitees.map((f, i) => (
                <View key={`${f.displayName}-${i}`} style={[styles.friend, i > 0 && styles.friendBorder]}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {f.displayName}
                  </Text>
                  {f.rewardedAt ? (
                    <View style={styles.done}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                      <Text style={styles.doneText}>Đã nhận thưởng</Text>
                    </View>
                  ) : (
                    <Text style={styles.progress}>
                      Đã học {f.studyDays}/{data.requiredStudyDays} ngày
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>Chương trình mời bạn đang tạm dừng.</Text>
      )}
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
  flex: { flex: 1 },
  partner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.gold,
    borderRadius: 18,
    padding: spacing.md,
  },
  partnerTitle: { fontSize: 15, fontWeight: "800", color: colors.white },
  partnerSub: { fontSize: 13, color: colors.white, opacity: 0.9 },
  hero: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: 6,
    ...shadow.card,
  },
  heroLabel: { fontSize: 14, fontWeight: "700", color: colors.white, opacity: 0.85 },
  code: { fontSize: 40, fontWeight: "800", color: colors.white, letterSpacing: 6 },
  heroSub: { fontSize: 13, color: colors.white, opacity: 0.9, textAlign: "center", lineHeight: 19 },
  shareButton: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 99,
  },
  shareText: { fontSize: 15, fontWeight: "700", color: colors.accent },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: -4 },
  inputRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  applyButton: { backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 18, justifyContent: "center", minWidth: 96, alignItems: "center" },
  applyDisabled: { opacity: 0.5 },
  applyText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  message: { fontSize: 14, fontWeight: "600", color: colors.accent, lineHeight: 20 },
  messageError: { color: colors.danger },
  hint: { fontSize: 13, color: colors.muted, textAlign: "center" },
  notes: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.muted },
  friend: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: 8 },
  friendBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  friendName: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  progress: { fontSize: 13, color: colors.muted },
  done: { flexDirection: "row", alignItems: "center", gap: 4 },
  doneText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  pressed: { opacity: 0.7 },
});
