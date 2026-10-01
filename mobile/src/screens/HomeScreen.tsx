import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { MainTabParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

export function HomeScreen() {
  const { me, user } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>4UME</Text>
      <Text style={styles.hello}>Xin chào, {me?.displayName ?? user?.displayName}</Text>
      <Text style={styles.progress}>
        Đã nhớ {me?.knownWords ?? 0} từ · Đang khó {me?.hardWords ?? 0} · Ngữ pháp{" "}
        {me?.grammarLessonsCompleted ?? 0}/10
      </Text>

      <Pressable style={styles.entry} onPress={() => navigation.navigate("Study")}>
        <Text style={styles.entryTitle}>Từ vựng</Text>
        <Text style={styles.entrySub}>23 bộ · A1–B2</Text>
      </Pressable>

      <Pressable style={styles.entry} onPress={() => navigation.navigate("Study")}>
        <Text style={styles.entryTitle}>Ngữ pháp</Text>
        <Text style={styles.entrySub}>10 bài căn bản</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  brand: { marginTop: spacing.lg, color: colors.accent, fontWeight: "800", fontSize: 18 },
  hello: { fontSize: 28, fontWeight: "700", color: colors.ink },
  progress: { color: colors.muted, marginBottom: spacing.md },
  entry: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryTitle: { fontSize: 22, fontWeight: "700", color: colors.accent },
  entrySub: { marginTop: 6, color: colors.muted },
});
