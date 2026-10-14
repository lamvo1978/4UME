import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, PracticeOverview, VOCAB_LEVELS, VocabLevel } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Screen } from "../components/Screen";
import { ErrorRetry } from "../components/ErrorRetry";
import { PracticeMode, RootStackParamList } from "../navigation/types";
import { speechToTextAvailable } from "../speech/useSpeechToText";
import { colors, fonts, shadow, spacing } from "../theme";

const MODES: { key: PracticeMode; title: string; text: string; icon: keyof typeof Ionicons.glyphMap; speaks: boolean }[] = [
  { key: "type", title: "Nghe – chép", text: "Nghe câu tiếng Anh rồi gõ lại cả câu.", icon: "create-outline", speaks: false },
  { key: "speak", title: "Nghe – nói", text: "Nghe câu rồi nói lại, máy nghe và so từng từ.", icon: "mic-outline", speaks: true },
  { key: "mix", title: "Trộn", text: "Xen kẽ câu chép và câu nói.", icon: "shuffle-outline", speaks: true },
];

export function SentenceHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { me } = useAuth();
  const [level, setLevel] = useState<VocabLevel>(me?.settings.vocabLevel ?? "A1");
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError("");
      api
        .practiceOverview()
        .then((o) => active && setOverview(o))
        .catch((e) => active && setError(e instanceof Error ? e.message : "Không tải được phần luyện câu"));
      return () => {
        active = false;
      };
    }, [attempt])
  );

  const countOf = (l: VocabLevel) => overview?.levels.find((x) => x.level === l)?.count ?? 0;
  const count = countOf(level);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Luyện</Text>
        <Text style={styles.intro}>
          Mỗi lượt 10 câu ngắn đời thường. Nghe giọng người bản xứ rồi chép lại hoặc nói lại cả câu — luyện cả tai lẫn miệng. Miễn phí, không giới hạn.
        </Text>

        <Text style={styles.label}>Cấp độ</Text>
        <View style={styles.levels}>
          {VOCAB_LEVELS.map((l) => {
            const on = l === level;
            return (
              <Pressable key={l} onPress={() => setLevel(l)} style={[styles.level, on && styles.levelOn]}>
                <Text style={[styles.levelText, on && styles.levelTextOn]}>{l}</Text>
                {overview ? <Text style={[styles.levelCount, on && styles.levelTextOn]}>{countOf(l)} câu</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <ErrorRetry message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !overview ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : count === 0 ? (
          <Text style={styles.empty}>Cấp {level} đang được soạn câu, bạn thử cấp khác nhé.</Text>
        ) : (
          <View style={styles.modes}>
            {MODES.map((m) => {
              const blocked = m.speaks && !speechToTextAvailable;
              return (
                <Pressable
                  key={m.key}
                  disabled={blocked}
                  onPress={() => navigation.navigate("SentencePractice", { level, mode: m.key })}
                  style={({ pressed }) => [styles.mode, blocked && styles.blocked, pressed && styles.pressed]}
                >
                  <View style={styles.modeIcon}>
                    <Ionicons name={m.icon} size={24} color={colors.accent} />
                  </View>
                  <View style={styles.modeBody}>
                    <Text style={styles.modeTitle}>{m.title}</Text>
                    <Text style={styles.modeText}>{blocked ? "Cần bản app mới nhất trên cửa hàng ứng dụng." : m.text}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  heading: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: colors.accent },
  intro: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  levels: { flexDirection: "row", gap: 8 },
  level: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: colors.bgAlt },
  levelOn: { backgroundColor: colors.accent },
  levelText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  levelCount: { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 1 },
  levelTextOn: { color: colors.white },
  loader: { marginTop: spacing.xl },
  empty: { textAlign: "center", color: colors.muted, marginTop: spacing.lg, lineHeight: 20 },
  modes: { gap: 10, marginTop: spacing.sm },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...shadow.card,
    shadowOpacity: 0.05,
  },
  blocked: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  modeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  modeBody: { flex: 1, gap: 2 },
  modeTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  modeText: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
