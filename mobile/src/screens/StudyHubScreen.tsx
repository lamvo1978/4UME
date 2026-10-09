import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { useHubTab } from "../navigation/useHubTab";
import { colors, fonts, spacing } from "../theme";
import { DecksScreen } from "./DecksScreen";
import { GrammarListScreen } from "./GrammarListScreen";

const TABS = [
  { key: "vocab", label: "Từ vựng" },
  { key: "grammar", label: "Ngữ pháp" },
] as const;

export function StudyHubScreen() {
  const [tab, setTab] = useHubTab();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Học</Text>
        <Segmented items={TABS} value={tab} onChange={setTab} />
      </View>
      <View style={styles.body}>{tab === "vocab" ? <DecksScreen /> : <GrammarListScreen />}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  body: { flex: 1 },
});
