import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, ReactNode, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api, Me, UserSettings } from "../../api/client";
import { ensureReminderPermission } from "../../notifications/reminders";
import { colors, shadow, spacing } from "../../theme";
import { speak } from "../SpeakButton";

const GOALS = [
  { value: 5, label: "Nhẹ" },
  { value: 10, label: "Vừa" },
  { value: 15, label: "Chăm" },
  { value: 20, label: "Siêu" },
];

const RATES = [
  { value: 0.7, label: "Chậm" },
  { value: 0.9, label: "Vừa" },
  { value: 1.1, label: "Nhanh" },
];

const REMINDER_TIMES = ["07:00", "12:00", "19:00", "20:00", "21:00", "22:00"];

export function SettingsSection({ me, onChange }: { me: Me; onChange: (changes: Partial<UserSettings>) => void }) {
  const s = me.settings;
  const rate = RATES.reduce((best, r) => (Math.abs(r.value - s.speechRate) < Math.abs(best.value - s.speechRate) ? r : best));

  const [rescueTime, setRescueTime] = useState<string | null>(null);

  useEffect(() => {
    api
      .config()
      .then((c) => setRescueTime(c.notifications.rescueTime))
      .catch(() => undefined);
  }, []);

  async function toggleNotification(key: "reminderEnabled" | "notifyRescue", enabled: boolean) {
    if (enabled && !(await ensureReminderPermission())) {
      Alert.alert("Chưa bật thông báo", "Hãy cho phép 4UME gửi thông báo trong Cài đặt của máy để nhận nhắc học.", [
        { text: "Để sau", style: "cancel" },
        { text: "Mở Cài đặt", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    onChange({ [key]: enabled });
  }

  return (
    <View style={styles.card}>
      <Row icon="flag-outline" title="Mục tiêu mỗi ngày" subtitle={`${s.dailyGoal} từ mới · cũng là số từ mỗi lượt học`}>
        <View style={styles.pills}>
          {GOALS.map((g) => (
            <Pill
              key={g.value}
              active={s.dailyGoal === g.value}
              title={String(g.value)}
              caption={g.label}
              onPress={() => onChange({ dailyGoal: g.value })}
            />
          ))}
        </View>
      </Row>

      <Row icon="speedometer-outline" title="Tốc độ phát âm" subtitle="Chạm vào loa để nghe thử">
        <View style={styles.pills}>
          {RATES.map((r) => (
            <Pill
              key={r.value}
              active={rate.value === r.value}
              title={r.label}
              onPress={() => {
                onChange({ speechRate: r.value });
                speak("Hello, nice to meet you!", r.value);
              }}
            />
          ))}
          <Pressable style={styles.test} onPress={() => speak("Hello, nice to meet you!", rate.value)} hitSlop={6}>
            <Ionicons name="volume-high" size={20} color={colors.accent} />
          </Pressable>
        </View>
      </Row>

      <Row
        icon="musical-notes-outline"
        title="Tự động phát âm"
        subtitle="Đọc từ khi lật thẻ và khi xem đáp án"
        right={<Switch value={s.autoSpeak} onValueChange={(v) => onChange({ autoSpeak: v })} trackColor={{ true: colors.accent }} />}
      />

      <Row
        icon="notifications-outline"
        title="Nhắc học hằng ngày"
        subtitle={s.reminderEnabled ? `Lúc ${s.reminderTime} nếu hôm đó bạn chưa học` : "Nhắc bạn giữ chuỗi ngày học"}
        right={
          <Switch
            value={s.reminderEnabled}
            onValueChange={(v) => toggleNotification("reminderEnabled", v)}
            trackColor={{ true: colors.accent }}
          />
        }
      >
        {s.reminderEnabled ? (
          <View style={styles.pills}>
            {REMINDER_TIMES.map((t) => (
              <Pill key={t} small active={s.reminderTime === t} title={t} onPress={() => onChange({ reminderTime: t })} />
            ))}
          </View>
        ) : null}
      </Row>

      <Row
        icon="flame-outline"
        title="Nhắc cứu chuỗi"
        subtitle={`${rescueTime ? `Lúc ${rescueTime}` : "Buổi tối"} nếu bạn sắp mất chuỗi ngày học`}
        right={
          <Switch
            value={s.notifyRescue}
            onValueChange={(v) => toggleNotification("notifyRescue", v)}
            trackColor={{ true: colors.accent }}
          />
        }
        last
      />
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  right,
  last,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  right?: ReactNode;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowTop}>
        <Ionicons name={icon} size={22} color={colors.accent} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Pill({
  active,
  title,
  caption,
  small,
  onPress,
}: {
  active: boolean;
  title: string;
  caption?: string;
  small?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, small && styles.pillSmall, active && styles.pillActive, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={[styles.pillTitle, small && styles.pillTitleSmall, active && styles.pillTitleActive]}>{title}</Text>
      {caption ? <Text style={[styles.pillCaption, active && styles.pillCaptionActive]}>{caption}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: spacing.md, ...shadow.card },
  row: { paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  rowSub: { marginTop: 2, fontSize: 13, color: colors.muted },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  pill: {
    flexGrow: 1,
    minWidth: 64,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillSmall: { minWidth: 70, flexGrow: 0, paddingVertical: 6 },
  pillActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  pillTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  pillTitleSmall: { fontSize: 14, fontWeight: "700" },
  pillTitleActive: { color: colors.white },
  pillCaption: { fontSize: 11, fontWeight: "600", color: colors.muted },
  pillCaptionActive: { color: colors.accentSoft },
  test: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
});
