import Ionicons from "@expo/vector-icons/Ionicons";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PronunciationStatus } from "../../api/client";
import { colors, shadow, spacing } from "../../theme";

const DAY_MS = 86_400_000;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Free vs Premium at a glance; there is no in-app purchase yet, so it only explains the plans. */
export function PlanCard({ status }: { status: PronunciationStatus }) {
  const premium = status.premium && !!status.premiumUntil;
  const daysLeft = premium ? Math.max(1, Math.ceil((new Date(status.premiumUntil!).getTime() - Date.now()) / DAY_MS)) : 0;

  return (
    <View style={[styles.card, premium && styles.cardPremium]}>
      <View style={styles.head}>
        <View style={[styles.icon, premium && styles.iconPremium]}>
          <Ionicons name={premium ? "sparkles" : "leaf-outline"} size={22} color={premium ? colors.white : colors.accent} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title}>{premium ? "Premium" : "Gói miễn phí"}</Text>
          <Text style={styles.subtitle}>
            {premium ? `Đến ${formatDate(status.premiumUntil!)} · còn ${daysLeft} ngày` : "Học từ, ngữ pháp, luyện nghe đầy đủ"}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={[styles.cell, styles.labelCell]} />
          <Text style={[styles.cell, styles.colHead, !premium && styles.colCurrent]}>Miễn phí</Text>
          <Text style={[styles.cell, styles.colHead, premium && styles.colCurrent]}>Premium</Text>
        </View>
        <Row label="Học từ, ngữ pháp, luyện nghe" free={<Check />} paid={<Check />} />
        <Row
          label="Chấm phát âm chi tiết từng âm"
          free={<Text style={styles.value}>{status.freeDailyLimit} lượt/ngày</Text>}
          paid={<Text style={[styles.value, styles.valueStrong]}>{status.premiumDailyLimit} lượt/ngày</Text>}
        />
        <Row label="Tự so sánh giọng khi hết lượt" free={<Check />} paid={<Check />} />
      </View>

      {status.enabled ? (
        <Text style={styles.usage}>
          Hôm nay còn {status.remaining}/{status.dailyLimit} lượt chấm chi tiết.
        </Text>
      ) : null}
      {!premium ? <Text style={styles.note}>Đăng ký Premium ngay trong app sẽ có ở bản cập nhật tới.</Text> : null}
    </View>
  );
}

function Row({ label, free, paid }: { label: string; free: ReactNode; paid: ReactNode }) {
  return (
    <View style={[styles.row, styles.bodyRow]}>
      <Text style={[styles.cell, styles.labelCell, styles.label]}>{label}</Text>
      <View style={styles.cell}>{free}</View>
      <View style={styles.cell}>{paid}</View>
    </View>
  );
}

function Check() {
  return <Ionicons name="checkmark-circle" size={20} color={colors.accent} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.md, ...shadow.card },
  cardPremium: { borderWidth: 1.5, borderColor: colors.gold },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPremium: { backgroundColor: colors.gold },
  headText: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  subtitle: { marginTop: 2, fontSize: 13, color: colors.muted },
  table: { borderRadius: 14, backgroundColor: colors.bg, paddingHorizontal: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  bodyRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cell: { width: 84, alignItems: "center", textAlign: "center" },
  labelCell: { flex: 1, width: undefined, alignItems: "flex-start", textAlign: "left" },
  label: { fontSize: 14, color: colors.ink, paddingRight: spacing.xs },
  colHead: { fontSize: 12, fontWeight: "700", color: colors.muted },
  colCurrent: { color: colors.accent },
  value: { fontSize: 12, color: colors.muted, textAlign: "center" },
  valueStrong: { color: colors.accent, fontWeight: "700" },
  usage: { fontSize: 13, color: colors.ink },
  note: { fontSize: 12, color: colors.muted },
});
