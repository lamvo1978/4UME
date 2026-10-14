import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { colors, spacing } from "../../theme";
import { Avatar, AVATAR_GROUPS, AVATARS } from "../Avatar";
import { FormSheet } from "./FormSheet";

const COLUMNS = 4;

/** Picks a built-in picture, or goes back to the name's initial. */
export function AvatarSheet({
  visible,
  name,
  current,
  onClose,
  welcome,
}: {
  visible: boolean;
  name?: string;
  current?: string | null;
  onClose: () => void;
  /** First pick right after sign-up: friendlier title, and closing reads "Để sau". */
  welcome?: boolean;
}) {
  const { updateSettings } = useAuth();
  const { height } = useWindowDimensions();
  const [picked, setPicked] = useState(current ?? "");
  useEffect(() => {
    if (visible) setPicked(current ?? "");
  }, [visible, current]);

  const initialPicked = picked === "";
  return (
    <FormSheet
      visible={visible}
      title={welcome ? "Chọn ảnh đại diện nhé!" : "Ảnh đại diện"}
      description={welcome ? "Chọn một bạn đồng hành dễ thương. Đổi lại lúc nào cũng được ở Hồ sơ." : undefined}
      submitLabel="Lưu"
      cancelLabel={welcome ? "Để sau" : undefined}
      canSubmit={picked !== (current ?? "")}
      onSubmit={async () => {
        await updateSettings({ avatar: picked });
        onClose();
      }}
      onClose={onClose}
    >
      <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [styles.initialRow, initialPicked && styles.initialRowPicked, pressed && styles.pressed]}
          onPress={() => setPicked("")}
          accessibilityState={{ selected: initialPicked }}
        >
          <Avatar name={name} size={36} />
          <Text style={styles.initialText}>Dùng chữ cái đầu của tên</Text>
          {initialPicked ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
        </Pressable>

        {AVATAR_GROUPS.map(({ group, title }) => (
          <View key={group}>
            <Text style={styles.groupTitle}>{title}</Text>
            <View style={styles.grid}>
              {AVATARS.filter((a) => a.group === group).map((a) => {
                const selected = a.key === picked;
                return (
                  <Pressable
                    key={a.key}
                    style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                    onPress={() => setPicked(a.key)}
                    accessibilityLabel={a.label}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.frame, selected && styles.frameSelected]}>
                      <Avatar avatar={a.key} size={56} />
                    </View>
                    <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  initialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
  },
  initialRowPicked: { borderColor: colors.accent },
  initialText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  groupTitle: { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 14, fontWeight: "700", color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.xs },
  cell: { width: `${100 / COLUMNS}%`, alignItems: "center" },
  frame: { padding: 3, borderRadius: 40, borderWidth: 2.5, borderColor: "transparent" },
  frameSelected: { borderColor: colors.accent },
  label: { marginTop: 2, fontSize: 12, color: colors.muted },
  labelSelected: { color: colors.accent, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
