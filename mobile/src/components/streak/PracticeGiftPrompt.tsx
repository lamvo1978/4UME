import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { api } from "../../api/client";
import { localDate } from "../../ads/rewarded";
import { CelebrationVideo } from "../../celebration/CelebrationVideo";
import { CELEBRATION_GIFT } from "../../celebration/sources";
import { colors, shadow, spacing } from "../../theme";

const SHOWN_KEY = "practiceGiftShown";

/** The streak length behind today's gift, or null when there is none or it was already announced on this device. */
export async function practiceGiftToAnnounce() {
  if ((await AsyncStorage.getItem(SHOWN_KEY)) === localDate()) return null;
  const { access } = await api.practiceOverview();
  return access.state === "gift" ? access.giftEveryDays : null;
}

/** Announces the streak gift: the Luyện tab is open for the rest of today. */
export function PracticeGiftPrompt({ days, onOpen, onClose }: { days: number; onOpen: () => void; onClose: () => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const videoWidth = Math.min(windowWidth - spacing.lg * 4, 280);

  const done = (then: () => void) => {
    AsyncStorage.setItem(SHOWN_KEY, localDate()).catch(() => undefined);
    then();
  };
  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => done(onClose)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <CelebrationVideo
            source={CELEBRATION_GIFT}
            width={videoWidth}
            replayKey={days}
            haptics={false}
          />
          <Text style={styles.title}>Quà giữ chuỗi {days} ngày!</Text>
          <Text style={styles.sub}>Hôm nay bạn được mở tab Luyện — nghe chép, nghe nói thoải mái tới 23:59.</Text>
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => done(onOpen)}>
            <Text style={styles.buttonText}>Luyện ngay</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.later, pressed && styles.pressed]} onPress={() => done(onClose)}>
            <Text style={styles.laterText}>Để sau</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(26,46,40,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.lg,
    paddingTop: spacing.md,
    ...shadow.card,
  },
  title: { marginTop: spacing.sm, fontSize: 20, fontWeight: "800", color: colors.ink, textAlign: "center" },
  sub: { marginTop: 8, fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21 },
  button: { alignSelf: "stretch", marginTop: spacing.lg, paddingVertical: 15, borderRadius: 16, alignItems: "center", backgroundColor: colors.flame },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "800" },
  later: { alignSelf: "stretch", marginTop: spacing.sm, paddingVertical: 12, alignItems: "center" },
  laterText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.8 },
});
