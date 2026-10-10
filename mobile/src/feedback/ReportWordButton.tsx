import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text } from "react-native";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme";

/** Opens a "Nội dung sai" feedback form tied to this word. */
export function ReportWordButton({ wordId, wordText }: { wordId: string; wordText: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => navigation.navigate("FeedbackNew", { category: "content", wordId, wordText })}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      accessibilityLabel={`Báo lỗi từ ${wordText}`}
    >
      <Ionicons name="flag-outline" size={13} color={colors.muted} />
      <Text style={styles.text}>Báo lỗi từ này</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "center", paddingVertical: 4, paddingHorizontal: 8 },
  text: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  pressed: { opacity: 0.5 },
});
