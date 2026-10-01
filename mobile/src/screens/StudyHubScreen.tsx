import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { DecksScreen } from "./DecksScreen";
import { GrammarListScreen } from "./GrammarListScreen";

export function StudyHubScreen() {
  const [tab, setTab] = useState<"vocab" | "grammar">("vocab");

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "vocab" && styles.tabActive]}
          onPress={() => setTab("vocab")}
        >
          <Text style={[styles.tabText, tab === "vocab" && styles.tabTextActive]}>Từ vựng</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "grammar" && styles.tabActive]}
          onPress={() => setTab("grammar")}
        >
          <Text style={[styles.tabText, tab === "grammar" && styles.tabTextActive]}>Ngữ pháp</Text>
        </Pressable>
      </View>
      <View style={styles.body}>{tab === "vocab" ? <DecksScreen /> : <GrammarListScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  body: { flex: 1 },
});
