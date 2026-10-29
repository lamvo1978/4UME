import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ConversationScenario, ConversationStatus, VOCAB_LEVELS, VocabLevel } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorRetry } from "../components/ErrorRetry";
import { AiConsentModal, hasAiConsent, saveAiConsent } from "../conversation/aiConsent";
import { RootStackParamList } from "../navigation/types";
import { speechToTextAvailable } from "../speech/useSpeechToText";
import { colors, shadow, spacing } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

const iconOf = (name: string): IconName => (name in Ionicons.glyphMap ? (name as IconName) : "chatbubbles-outline");

export function ConversationHubScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "ConversationHub">) {
  const { me } = useAuth();
  const [level, setLevel] = useState<VocabLevel>(me?.settings.vocabLevel ?? "A1");
  const [status, setStatus] = useState<ConversationStatus | null>(null);
  const [scenarios, setScenarios] = useState<ConversationScenario[] | null>(null);
  const [statusError, setStatusError] = useState("");
  const [scenariosError, setScenariosError] = useState("");
  const [attempt, setAttempt] = useState(0);
  /** Set while the AI consent box is open; holds where to go after "Đồng ý". */
  const [asking, setAsking] = useState<{ scenario: ConversationScenario | null } | null>(null);
  const vocabLevel = me?.settings.vocabLevel;

  useEffect(() => {
    if (vocabLevel) setLevel(vocabLevel);
  }, [vocabLevel]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setStatusError("");
      setScenariosError("");
      void Promise.allSettled([api.conversationStatus(), api.conversationScenarios()]).then(([statusRes, scenariosRes]) => {
        if (!active) return;
        if (statusRes.status === "fulfilled") setStatus(statusRes.value);
        else setStatusError(statusRes.reason instanceof Error ? statusRes.reason.message : "Không tải được lượt đàm thoại");
        if (scenariosRes.status === "fulfilled") setScenarios(scenariosRes.value);
        else setScenariosError(scenariosRes.reason instanceof Error ? scenariosRes.reason.message : "Không tải được tình huống");
      });
      return () => {
        active = false;
      };
    }, [attempt])
  );

  if (scenariosError && !scenarios) {
    return (
      <View style={styles.center}>
        <ErrorRetry message={scenariosError} onRetry={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }
  if (!scenarios) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (statusError && !status) {
    return (
      <View style={styles.center}>
        <ErrorRetry message={statusError} onRetry={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }
  if (!status) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const open = status.enabled && status.available;
  const canStart = !!status.nextSessionKind && status.remaining > 0;
  const blocked = !open || !canStart || !!statusError;
  const list = scenarios.filter((s) => s.level === level);
  const countOf = (l: VocabLevel) => scenarios.filter((s) => s.level === l).length;
  const go = (scenario: ConversationScenario | null) =>
    navigation.navigate("Conversation", {
      scenarioId: scenario?.id ?? null,
      level: scenario?.level ?? level,
      title: scenario?.titleVi ?? "Trò chuyện tự do",
    });
  const start = async (scenario: ConversationScenario | null) => {
    if (!me || (await hasAiConsent(me.userId))) go(scenario);
    else setAsking({ scenario });
  };
  const agree = async () => {
    const pending = asking;
    setAsking(null);
    if (me) await saveAiConsent(me.userId).catch(() => {});
    if (pending) go(pending.scenario);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AiConsentModal visible={asking !== null} onAgree={() => void agree()} onDecline={() => setAsking(null)} />
      <Text style={styles.intro}>
        Nói chuyện bằng tiếng Anh với AI. Bấm micro để nói (hoặc gõ chữ), AI trả lời, sửa câu của bạn và gợi ý câu tiếp theo.
      </Text>

      {statusError ? (
        <View style={styles.statusRetry}>
          <ErrorRetry message={statusError} onRetry={() => setAttempt((n) => n + 1)} />
        </View>
      ) : (
        <QuotaNote status={status} onPremium={() => navigation.navigate("Premium")} />
      )}
      {!speechToTextAvailable ? (
        <View style={styles.note}>
          <Ionicons name="keypad-outline" size={18} color={colors.accent} />
          <Text style={styles.noteText}>Máy này chưa nhận dạng được giọng nói, bạn gõ chữ để trò chuyện nhé (cần bản app mới nhất trên cửa hàng).</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Cấp độ</Text>
      <View style={styles.levels}>
        {VOCAB_LEVELS.map((l) => {
          const on = l === level;
          return (
            <Pressable key={l} onPress={() => setLevel(l)} style={[styles.level, on && styles.levelOn]}>
              <Text style={[styles.levelText, on && styles.levelTextOn]}>{l}</Text>
              <Text style={[styles.levelCount, on && styles.levelTextOn]}>{countOf(l)} tình huống</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        disabled={blocked}
        onPress={() => start(null)}
        style={({ pressed }) => [styles.card, styles.freeCard, blocked && styles.blocked, pressed && styles.pressed]}
      >
        <View style={[styles.icon, styles.freeIcon]}>
          <Ionicons name="sparkles" size={24} color={colors.white} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Trò chuyện tự do</Text>
          <Text style={styles.text}>Nói về bất cứ chủ đề nào, AI nói theo cấp {level} của bạn.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Text style={styles.label}>Nhập vai theo tình huống</Text>
      {list.length === 0 ? (
        <Text style={styles.empty}>Cấp {level} đang được soạn tình huống, bạn thử cấp khác hoặc trò chuyện tự do nhé.</Text>
      ) : (
        list.map((s) => (
          <Pressable
            key={s.id}
            disabled={blocked}
            onPress={() => start(s)}
            style={({ pressed }) => [styles.card, blocked && styles.blocked, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Ionicons name={iconOf(s.icon)} size={24} color={colors.accent} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{s.titleVi}</Text>
              <Text style={styles.text}>{s.goalVi}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function QuotaNote({ status, onPremium }: { status: ConversationStatus; onPremium: () => void }) {
  if (!status.enabled || !status.available) {
    return (
      <View style={styles.note}>
        <Ionicons name="construct-outline" size={18} color={colors.accent} />
        <Text style={styles.noteText}>Đàm thoại với AI đang tạm dừng, bạn quay lại sau nhé.</Text>
      </View>
    );
  }

  const turns = status.turnsPerSession || status.maxTurnsPerSession;
  const noSession = !status.nextSessionKind || status.remaining <= 0;

  if (noSession) {
    const title =
      status.blockedReason === "need_premium"
        ? "Chưa có buổi miễn phí hôm nay"
        : status.premium
          ? "Hết buổi đàm thoại hôm nay"
          : "Hết buổi miễn phí hôm nay";
    const body = emptyCopy(status);
    return (
      <View style={styles.lock}>
        <Ionicons name="time-outline" size={26} color={colors.accent} />
        <Text style={styles.lockTitle}>{title}</Text>
        <Text style={styles.lockText}>{body}</Text>
        {status.blockedReason === "need_premium" || (!status.premium && status.blockedReason !== "no_sessions_left") ? (
          <Pressable style={({ pressed }) => [styles.lockButton, pressed && styles.pressed]} onPress={onPremium}>
            <Text style={styles.lockButtonText}>Xem Premium</Text>
          </Pressable>
        ) : status.premium && !status.conversationAddon ? (
          <Pressable style={({ pressed }) => [styles.lockButton, pressed && styles.pressed]} onPress={onPremium}>
            <Text style={styles.lockButtonText}>Mở rộng đàm thoại</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const kind = status.nextSessionKind;
  const intro =
    kind === "first"
      ? "Bạn có một buổi thử đàm thoại AI."
      : kind === "streak_gift"
        ? "Hôm nay bạn có quà chuỗi: một buổi đàm thoại tới 23:59."
        : kind === "premium"
          ? "Buổi Premium hôm nay"
          : "Buổi mở rộng đàm thoại";

  return (
    <View style={styles.note}>
      <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
      <Text style={styles.noteText}>
        {status.premium ? "Premium · " : ""}
        {intro} · Còn {status.remaining}/{status.dailyLimit} lượt hôm nay · tối đa {turns} lượt/buổi.
      </Text>
    </View>
  );
}

function emptyCopy(status: ConversationStatus): string {
  if (status.blockedReason === "need_premium") {
    return "Hôm nay không còn buổi miễn phí. Giữ chuỗi 7 ngày để nhận một buổi (tới 23:59). Hoặc nâng cấp Premium (1 buổi/ngày).";
  }
  if (status.premium && !status.conversationAddon) {
    const extra = status.addonSessionsPerDay ?? 3;
    const turns = status.addonTurnsPerSession ?? status.maxTurnsPerSession ?? 20;
    return `Bạn đã dùng buổi Premium hôm nay. Gói mở rộng thêm ${extra} buổi/ngày (${turns} lượt/buổi) — xem màn Premium.`;
  }
  return "Bạn đã dùng hết buổi đàm thoại hôm nay, mai quay lại nhé.";
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, backgroundColor: colors.bg, flexGrow: 1 },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  statusRetry: { alignSelf: "stretch" },
  label: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  levels: { flexDirection: "row", gap: 8 },
  level: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: colors.bgAlt },
  levelOn: { backgroundColor: colors.accent },
  levelText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  levelCount: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  levelTextOn: { color: colors.white },
  note: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.accentSoft },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.ink },
  lock: { alignItems: "center", gap: 6, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.05 },
  lockTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  lockText: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: "center" },
  lockButton: { alignSelf: "stretch", alignItems: "center", marginTop: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent },
  lockButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  freeCard: { marginTop: spacing.sm },
  blocked: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  freeIcon: { backgroundColor: colors.accent },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  text: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
});
