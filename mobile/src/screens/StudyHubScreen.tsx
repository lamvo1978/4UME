import { StyleSheet, Text, View } from "react-native";
import { FEATURE_IELTS, hasFeature } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { useHubTab } from "../navigation/useHubTab";
import { colors, fonts, spacing } from "../theme";
import { DecksScreen } from "./DecksScreen";
import { GrammarListScreen } from "./GrammarListScreen";
import { IeltsHomeScreen } from "./IeltsHomeScreen";

const TABS = [
  { key: "vocab", label: "Từ vựng" },
  { key: "grammar", label: "Ngữ pháp" },
] as const;
const TABS_WITH_IELTS = [...TABS, { key: "ielts", label: "IELTS" }] as const;

export function StudyHubScreen() {
  const { me } = useAuth();
  const [requested, setTab] = useHubTab();
  const ielts = hasFeature(me, FEATURE_IELTS);
  // A revoked partner code hides the segment; fall back instead of showing an empty page.
  const tab = requested === "ielts" && !ielts ? "vocab" : requested;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Học</Text>
        <Segmented items={ielts ? TABS_WITH_IELTS : TABS} value={tab} onChange={setTab} />
      </View>
      <View style={styles.body}>
        {tab === "ielts" ? <IeltsHomeScreen /> : tab === "grammar" ? <GrammarListScreen /> : <DecksScreen />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  body: { flex: 1 },
});
