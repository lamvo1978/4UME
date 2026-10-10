import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaUrl } from "../api/client";
import { colors } from "../theme";

/** Thumbnails of images picked but not yet sent, each with a remove button. */
export function PendingImages({ uris, onRemove }: { uris: string[]; onRemove: (uri: string) => void }) {
  if (!uris.length) return null;
  return (
    <View style={styles.row}>
      {uris.map((uri) => (
        <View key={uri}>
          <Image source={{ uri }} style={styles.thumb} />
          <Pressable style={styles.remove} onPress={() => onRemove(uri)} hitSlop={8} accessibilityLabel="Bỏ ảnh">
            <Ionicons name="close" size={14} color={colors.white} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** Images on a sent message; tap to view full screen. */
export function MessageImages({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  if (!urls.length) return null;
  return (
    <>
      <View style={styles.row}>
        {urls.map((url) => (
          <Pressable key={url} onPress={() => setOpen(url)} accessibilityLabel="Xem ảnh">
            <Image source={{ uri: mediaUrl(url) ?? url }} style={styles.thumb} />
          </Pressable>
        ))}
      </View>
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(null)}>
          {open ? <Image source={{ uri: mediaUrl(open) ?? open }} style={styles.full} resizeMode="contain" /> : null}
          <View style={[styles.closeBtn, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={24} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.bgAlt },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  full: { width: "100%", height: "80%" },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
