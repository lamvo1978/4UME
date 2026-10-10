import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import { ComponentProps, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EasyWordMode, UserSettings, VocabLevel } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DeleteSheet, NameSheet, PasswordSheet } from "../components/profile/AccountSheets";
import { SettingsSection } from "../components/profile/SettingsSection";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { easierLabel, levelRank } from "../vocabulary/placement";

const FEEDBACK_EMAIL = "lamvo1978@gmail.com";

type Sheet = "name" | "password" | "delete" | null;

export function SettingsScreen() {
  const { me, user, logout, updateSettings, applyPlacement } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet>(null);
  const name = me?.displayName ?? user?.displayName;
  const version = Constants.expoConfig?.version ?? "1.0.0";

  function changeSettings(changes: Partial<UserSettings>) {
    updateSettings(changes).catch((e) => Alert.alert("Không lưu được", e instanceof Error ? e.message : "Thử lại sau nhé."));
  }

  function changeVocab(level: VocabLevel, mode: EasyWordMode) {
    const apply = () =>
      applyPlacement(level, mode, false).catch((e) =>
        Alert.alert("Không lưu được", e instanceof Error ? e.message : "Thử lại sau nhé.")
      );
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
        {me ? (
          <>
            <Text style={[styles.sectionTitle, styles.first]}>Cài đặt học</Text>
            <SettingsSection
              me={me}
              onChange={changeSettings}
              onVocabChange={changeVocab}
              onPlacementTest={() => navigation.navigate("Placement")}
            />
          </>
        ) : null}

        <Text style={[styles.sectionTitle, !me && styles.first]}>Tài khoản</Text>
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 0 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  first: { marginTop: spacing.md },
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
