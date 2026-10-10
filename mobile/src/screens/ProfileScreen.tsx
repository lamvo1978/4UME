import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import { ComponentProps, useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, EasyWordMode, PronunciationStatus, Stats, UserSettings, VocabLevel } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { ActivityCalendar } from "../components/profile/ActivityCalendar";
import { FormSheet, SheetInput } from "../components/profile/FormSheet";
import { MemoryCard } from "../components/profile/MemoryCard";
import { PlanCard } from "../components/profile/PlanCard";
import { SettingsSection } from "../components/profile/SettingsSection";
import { StreakCard } from "../components/profile/StreakCard";
import { Screen } from "../components/Screen";
import { RootStackParamList } from "../navigation/types";
import { colors, fonts, shadow, spacing } from "../theme";
import { formatMonthYear } from "../utils/dates";
import { easierLabel, levelRank } from "../vocabulary/placement";

const FEEDBACK_EMAIL = "lamvo1978@gmail.com";
const MIN_PASSWORD = 6;

type Sheet = "name" | "password" | "delete" | null;

export function ProfileScreen() {
  const { me, user, logout, refreshMe, updateSettings, applyPlacement } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [plan, setPlan] = useState<PronunciationStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const name = me?.displayName ?? user?.displayName;

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api.stats(), api.pronunciationStatus().catch(() => null), refreshMe()]);
      setStats(s);
      setPlan(p);
    } catch {
      // Keep showing the last stats; pull-to-refresh retries.
    }
  }, [refreshMe]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function changeSettings(changes: Partial<UserSettings>) {
    updateSettings(changes)
      .then(() => (changes.dailyGoal ? load() : undefined))
      .catch((e) => Alert.alert("Không lưu được", e instanceof Error ? e.message : "Thử lại sau nhé."));
  }

  function changeVocab(level: VocabLevel, mode: EasyWordMode) {
    const apply = () =>
      applyPlacement(level, mode, false)
        .then(load)
        .catch((e) => Alert.alert("Không lưu được", e instanceof Error ? e.message : "Thử lại sau nhé."));
    const wasKnown = me?.settings.easyWordMode === "known" && levelRank(me.settings.vocabLevel) > 0;
    const willMark = mode === "known" && levelRank(level) > 0;
    if (!wasKnown && !willMark) return apply();

    const keep = "Từ bạn tự học hoặc đã ôn vẫn giữ nguyên.";
    Alert.alert(
      willMark ? `Tính từ ${easierLabel(level)} là đã nhớ?` : "Bỏ đánh dấu từ dễ?",
      willMark
        ? `Các từ ${easierLabel(level)} chưa học sẽ được tính là đã nhớ và thỉnh thoảng xuất hiện trong Ôn tập. ${keep}`
        : `Các từ 4UME đã tự đánh dấu "đã nhớ" trở lại thành từ mới. ${keep}`,
      [
        { text: "Huỷ", style: "cancel" },
        { text: "Đồng ý", onPress: apply },
      ]
    );
  }

  function confirmLogout() {
    Alert.alert("Đăng xuất?", "Tiến trình học vẫn được lưu trên tài khoản của bạn.", [
      { text: "Huỷ", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => logout() },
    ]);
  }

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>Hồ sơ</Text>

        <View style={styles.user}>
          <Avatar name={name} size={64} />
          <View style={styles.userText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {me?.email ?? user?.email}
            </Text>
            {stats ? <Text style={styles.since}>Thành viên từ {formatMonthYear(stats.memberSince)}</Text> : null}
          </View>
          <Pressable style={styles.edit} onPress={() => setSheet("name")} hitSlop={8}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
          </Pressable>
        </View>

        {stats ? (
          <>
            <StreakCard streak={stats.streak} />

            <Section title="Hoạt động" />
            <ActivityCalendar today={stats.streak.today} days={stats.streak.days} totalDays={stats.totalStudyDays} />

            <Section title="Độ nhớ" hint="Từ và bài lên cấp mỗi lần ôn đúng; lên cấp 6 là đã thuộc." />
            <MemoryCard icon="book-outline" title="Từ vựng" unit="từ" learningLabel="Đang để học sau" memory={stats.vocabulary} />
            <View style={styles.gap} />
            <MemoryCard
              icon="document-text-outline"
              title="Ngữ pháp"
              unit="bài"
              learningLabel="Đã làm nhưng chưa đạt"
              memory={stats.grammar}
            />
          </>
        ) : (
          <View style={styles.placeholder} />
        )}

        {me ? (
          <>
            <Section title="Cài đặt học" />
            <SettingsSection
              me={me}
              onChange={changeSettings}
              onVocabChange={changeVocab}
              onPlacementTest={() => navigation.navigate("Placement")}
            />
          </>
        ) : null}

        {plan && (plan.enabled || plan.premium) ? (
          <>
            <Section title="Gói của bạn" />
            <PlanCard status={plan} />
          </>
        ) : null}

        <Section title="Tài khoản" />
        <View style={styles.card}>
          <ActionRow icon="person-outline" label="Đổi tên hiển thị" onPress={() => setSheet("name")} />
          <ActionRow icon="key-outline" label="Đổi mật khẩu" onPress={() => setSheet("password")} />
          <ActionRow icon="log-out-outline" label="Đăng xuất" onPress={confirmLogout} />
          <ActionRow icon="trash-outline" label="Xoá tài khoản" danger last onPress={() => setSheet("delete")} />
        </View>

        <View style={[styles.card, styles.gapTop]}>
          <ActionRow
            icon="information-circle-outline"
            label="Giới thiệu & bản quyền"
            last
            onPress={() => navigation.navigate("About")}
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.feedback, pressed && styles.pressed]}
            onPress={() => Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Góp ý 4UME ${version}`)}`)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accent} />
            <Text style={styles.feedbackText}>Gửi góp ý</Text>
          </Pressable>
          <Text style={styles.version}>4UME · phiên bản {version}</Text>
        </View>
      </ScrollView>

      <NameSheet visible={sheet === "name"} current={name ?? ""} onClose={() => setSheet(null)} />
      <PasswordSheet visible={sheet === "password"} onClose={() => setSheet(null)} />
      <DeleteSheet visible={sheet === "delete"} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function NameSheet({ visible, current, onClose }: { visible: boolean; current: string; onClose: () => void }) {
  const { updateSettings } = useAuth();
  const [value, setValue] = useState(current);
  useEffect(() => {
    if (visible) setValue(current);
  }, [visible, current]);
  return (
    <FormSheet
      visible={visible}
      title="Đổi tên hiển thị"
      submitLabel="Lưu"
      canSubmit={value.trim().length > 0 && value.trim() !== current}
      onClose={onClose}
      onSubmit={async () => {
        await updateSettings({ displayName: value.trim() });
        onClose();
      }}
    >
      <SheetInput label="Tên" value={value} onChangeText={setValue} autoFocus maxLength={60} />
    </FormSheet>
  );
}

function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const close = () => {
    setCurrent("");
    setNext("");
    onClose();
  };
  return (
    <FormSheet
      visible={visible}
      title="Đổi mật khẩu"
      submitLabel="Đổi mật khẩu"
      canSubmit={current.length > 0 && next.length >= MIN_PASSWORD}
      onClose={close}
      onSubmit={async () => {
        await api.changePassword(current, next);
        close();
        Alert.alert("Đã đổi mật khẩu", "Lần đăng nhập sau hãy dùng mật khẩu mới.");
      }}
    >
      <SheetInput label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry autoFocus />
      <SheetInput
        label={`Mật khẩu mới (tối thiểu ${MIN_PASSWORD} ký tự)`}
        value={next}
        onChangeText={setNext}
        secureTextEntry
      />
    </FormSheet>
  );
}

function DeleteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const close = () => {
    setPassword("");
    onClose();
  };
  return (
    <FormSheet
      visible={visible}
      title="Xoá tài khoản"
      description="Toàn bộ tiến trình học, chuỗi ngày học và cài đặt sẽ bị xoá vĩnh viễn, không thể khôi phục."
      submitLabel="Xoá vĩnh viễn"
      danger
      canSubmit={password.length > 0}
      onClose={close}
      onSubmit={async () => {
        await api.deleteAccount(password);
        close();
        await logout();
      }}
    >
      <SheetInput label="Nhập mật khẩu để xác nhận" value={password} onChangeText={setPassword} secureTextEntry autoFocus />
    </FormSheet>
  );
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  danger,
  last,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  danger?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.action, last && styles.actionLast, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.accent} />
      <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  user: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg },
  userText: { flex: 1 },
  name: { fontSize: 22, fontWeight: "700", color: colors.ink },
  email: { marginTop: 2, color: colors.muted },
  since: { marginTop: 2, fontSize: 12, color: colors.muted },
  edit: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: { height: 320, borderRadius: 24, backgroundColor: colors.surface, opacity: 0.6 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  sectionHint: { marginTop: 2, fontSize: 13, color: colors.muted },
  gap: { height: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: spacing.md, ...shadow.card },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionLast: { borderBottomWidth: 0 },
  actionText: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  danger: { color: colors.danger },
  footer: { alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: colors.accentSoft,
  },
  feedbackText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  version: { fontSize: 12, color: colors.muted },
  gapTop: { marginTop: spacing.md },
  pressed: { opacity: 0.6 },
});
