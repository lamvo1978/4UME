import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SessionDoneView } from "../components/SessionDoneView";
import {
  CELEBRATION_DONE,
  CELEBRATION_GIFT,
  CELEBRATION_STREAK,
} from "../celebration/sources";
import { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CelebrationPreview">;

type PresetKey = "review-due" | "review-practice" | "grammar-due" | "grammar-practice";
type VideoKey = "done" | "streak" | "gift";

const PRESETS: Record<
  PresetKey,
  { label: string; title: string; subtitle: string; stats: { value: number; label: string }[]; primaryLabel: string }
> = {
  "review-due": {
    label: "Ôn tập",
    title: "Xong bài ôn hôm nay",
    subtitle: "Đã ôn 10 từ qua 18 bài tập.",
    stats: [
      { value: 9, label: "Lên cấp" },
      { value: 1, label: "Ôn lại sớm" },
    ],
    primaryLabel: "Luyện thêm 10 từ",
  },
  "review-practice": {
    label: "Luyện từ",
    title: "Xong lượt luyện",
    subtitle: "Đã luyện 10 từ qua 18 bài tập.",
    stats: [
      { value: 8, label: "Không sai" },
      { value: 2, label: "Có sai" },
    ],
    primaryLabel: "Luyện tiếp",
  },
  "grammar-due": {
    label: "Ôn ngữ pháp",
    title: "Xong bài ôn ngữ pháp",
    subtitle: "1 bài · 8 câu",
    stats: [
      { value: 1, label: "Lên cấp" },
      { value: 0, label: "Ôn lại sớm" },
    ],
    primaryLabel: "Luyện thêm",
  },
  "grammar-practice": {
    label: "Luyện NP",
    title: "Xong lượt luyện",
    subtitle: "1 bài · 8 câu",
    stats: [
      { value: 0, label: "Không sai" },
      { value: 1, label: "Có sai" },
    ],
    primaryLabel: "Luyện tiếp",
  },
};

const VIDEOS: Record<VideoKey, number> = {
  done: CELEBRATION_DONE,
  streak: CELEBRATION_STREAK,
  gift: CELEBRATION_GIFT,
};

/** Dev-only: preview completion screens and celebration clips without finishing a session. */
export function CelebrationPreviewScreen({ navigation }: Props) {
  const [preset, setPreset] = useState<PresetKey>("review-due");
  const [video, setVideo] = useState<VideoKey>("done");
  const [replayKey, setReplayKey] = useState(0);
  const [transparentWrap, setTransparentWrap] = useState(true);
  const [contentFit, setContentFit] = useState<"cover" | "contain">("contain");
  const wrapBg = transparentWrap ? "transparent" : colors.bg;

  const p = PRESETS[preset];

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Giả lập màn xong bài</Text>
        <View style={styles.chips}>
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <Chip key={key} label={PRESETS[key].label} on={preset === key} onPress={() => setPreset(key)} />
          ))}
        </View>
        <Text style={styles.toolbarHint}>Video</Text>
        <View style={styles.chips}>
          <Chip label="Xong bài" on={video === "done"} onPress={() => setVideo("done")} />
          <Chip label="Chuỗi ngày" on={video === "streak"} onPress={() => setVideo("streak")} />
          <Chip label="Quà luyện" on={video === "gift"} onPress={() => setVideo("gift")} />
        </View>
        <View style={styles.chips}>
          <Chip label="Nền trong" on={transparentWrap} onPress={() => setTransparentWrap(true)} />
          <Chip label="Nền mint app" on={!transparentWrap} onPress={() => setTransparentWrap(false)} />
          <Chip label="Contain" on={contentFit === "contain"} onPress={() => setContentFit("contain")} />
          <Chip label="Cover" on={contentFit === "cover"} onPress={() => setContentFit("cover")} />
        </View>
        <Pressable style={styles.replayBtn} onPress={() => setReplayKey((k) => k + 1)}>
          <Text style={styles.replayText}>Chạy lại video</Text>
        </Pressable>
        <Text style={styles.note}>Thay file `.mp4` trong `mobile/assets/celebration/` rồi reload Metro.</Text>
      </View>
      <SessionDoneView
        title={p.title}
        subtitle={p.subtitle}
        stats={p.stats}
        primaryLabel={p.primaryLabel}
        onPrimary={() => setReplayKey((k) => k + 1)}
        onSecondary={() => navigation.goBack()}
        videoSource={VIDEOS[video]}
        replayKey={replayKey}
        videoBackground={wrapBg}
        videoContentFit={contentFit}
      />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  toolbar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toolbarTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  toolbarHint: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextOn: { color: colors.accent },
  replayBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  replayText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
});
