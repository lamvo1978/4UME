import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { colors, spacing } from "../../theme";
import { Avatar, AVATARS } from "../Avatar";
import { FormSheet } from "./FormSheet";

const COLUMNS = 4;

/** Picks a built-in picture; the first cell goes back to the name's initial. */
export function AvatarSheet({
  visible,
  name,
  current,
  onClose,
}: {
  visible: boolean;
  name?: string;
  current?: string | null;
  onClose: () => void;
}) {
  const { updateSettings } = useAuth();
  const [picked, setPicked] = useState(current ?? "");
  useEffect(() => {
    if (visible) setPicked(current ?? "");
  }, [visible, current]);

  const cells = [{ key: "", label: "Chữ cái đầu" }, ...AVATARS];
  return (
    <FormSheet
      visible={visible}
      title="Ảnh đại diện"
      description="Chọn một hình bạn thích."
      submitLabel="Lưu"
      canSubmit={picked !== (current ?? "")}
      onSubmit={async () => {
        await updateSettings({ avatar: picked });
        onClose();
      }}
      onClose={onClose}
    >
      <View style={styles.grid}>
        {cells.map((cell) => {
          const selected = cell.key === picked;
          return (
            <Pressable
              key={cell.key || "initial"}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
              onPress={() => setPicked(cell.key)}
              accessibilityLabel={cell.label}
              accessibilityState={{ selected }}
            >
              <View style={[styles.frame, selected && styles.frameSelected]}>
                <Avatar name={name} avatar={cell.key} size={60} />
              </View>
              {selected ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm },
  cell: { width: `${100 / COLUMNS}%`, alignItems: "center" },
  frame: { padding: 3, borderRadius: 40, borderWidth: 2.5, borderColor: "transparent" },
  frameSelected: { borderColor: colors.accent },
  check: {
    position: "absolute",
    top: 0,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
});
