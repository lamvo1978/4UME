import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { ComponentProps, ReactNode, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import libraries from "../about/licenses.json";
import { colors, fonts, shadow, spacing } from "../theme";

/** Wording required by the CEFR-J licence; keep it verbatim (backend/data/sources/README.md). */
const CEFRJ_CITATION =
  "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://www.cefr-j.org/download.html on 08/10/2026.";
const CEFRJ_URL = "https://www.cefr-j.org/download.html";

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

type Icon = ComponentProps<typeof Ionicons>["name"];

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [showMit, setShowMit] = useState(false);
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const open = (url: string) => () => Linking.openURL(url);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.hero}>
        <Image source={require("../../assets/logo-emblem.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>4UME</Text>
        <Text style={styles.version}>Phiên bản {version}</Text>
        <Text style={styles.tagline}>
          Học từ vựng và ngữ pháp tiếng Anh từ A1 đến B2 cho người Việt: ôn tập cách quãng, luyện nghe và luyện phát âm.
        </Text>
      </View>

      <Section title="Nội dung học">
        <Item icon="book-outline" title="Từ vựng">
          Danh sách từ và cấp độ A1–B2 dựa trên CEFR-J Wordlist. Nghĩa tiếng Việt, phiên âm và câu ví dụ do 4UME biên soạn.
        </Item>
        <Item icon="document-text-outline" title="Ngữ pháp">
          Bài học và bài tập do 4UME biên soạn.
        </Item>
        <Item icon="headset-outline" title="Bài nghe" last>
          Kịch bản do 4UME biên soạn; một số bài được viết nháp với Google Gemini rồi biên tập lại.
        </Item>
      </Section>

      <Section title="Nguồn dữ liệu">
        <Text style={styles.body}>Danh sách từ và cấp độ CEFR dùng theo giấy phép của CEFR-J, có trích dẫn:</Text>
        <Pressable onPress={open(CEFRJ_URL)} style={({ pressed }) => [styles.quote, pressed && styles.pressed]}>
          <Text style={styles.quoteText}>{CEFRJ_CITATION}</Text>
        </Pressable>
      </Section>

      <Section title="Giọng đọc và AI">
        <Item icon="mic-outline" title="Giọng đọc bài nghe">
          Giọng đọc tổng hợp (AI) của Microsoft Azure AI Speech.
        </Item>
        <Item icon="volume-medium-outline" title="Phát âm từ vựng">
          Giọng đọc có sẵn trên điện thoại của bạn.
        </Item>
        <Item icon="pulse-outline" title="Chấm phát âm" last>
          Microsoft Azure AI Speech (Pronunciation Assessment). Bản ghi giọng chỉ dùng để chấm điểm, 4UME không lưu lại.
        </Item>
      </Section>

      <Section title="Hình ảnh">
        <Text style={styles.body}>
          Ảnh minh hoạ từ vựng lấy từ{" "}
          <Text style={styles.link} onPress={open("https://pixabay.com/service/license-summary/")}>
            Pixabay
          </Text>{" "}
          và{" "}
          <Text style={styles.link} onPress={open("https://www.pexels.com/license/")}>
            Pexels
          </Text>
          , dùng theo giấy phép miễn phí của hai trang. Biểu tượng trong app là bộ Ionicons (giấy phép MIT). Logo và nhận diện
          4UME thuộc về 4UME.
        </Text>
      </Section>

      <Section title="Phần mềm mã nguồn mở">
        <Text style={styles.body}>4UME được xây dựng với các thư viện sau. Chạm vào tên để xem mã nguồn.</Text>
        <View style={styles.libs}>
          {libraries.map((lib, i) => (
            <Pressable
              key={lib.name}
              onPress={open(lib.url)}
              style={({ pressed }) => [styles.lib, i === libraries.length - 1 && styles.libLast, pressed && styles.pressed]}
            >
              <View style={styles.libText}>
                <Text style={styles.libName}>{lib.name}</Text>
                <Text style={styles.libMeta}>
                  {lib.version}
                  {lib.author ? ` · ${lib.author}` : ""}
                </Text>
              </View>
              <Text style={styles.license}>{lib.license}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setShowMit((v) => !v)} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <Text style={styles.toggleText}>{showMit ? "Ẩn" : "Xem"} nội dung giấy phép MIT</Text>
          <Ionicons name={showMit ? "chevron-up" : "chevron-down"} size={16} color={colors.accent} />
        </Pressable>
        {showMit ? <Text style={styles.mit}>{MIT_TEXT}</Text> : null}
      </Section>

      <Text style={styles.copyright}>© {new Date().getFullYear()} 4UME. Bảo lưu mọi quyền.</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Item({ icon, title, children, last }: { icon: Icon; title: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.item, last && styles.itemLast]}>
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.body}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.md },
  hero: { alignItems: "center", gap: 4, marginBottom: spacing.sm },
  logo: { width: 72, height: 72 },
  brand: { fontFamily: fonts.display, fontSize: 30, fontWeight: "700", color: colors.accent },
  version: { fontSize: 13, color: colors.muted },
  tagline: { marginTop: spacing.xs, fontSize: 15, lineHeight: 22, color: colors.ink, textAlign: "center" },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  item: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemLast: { paddingBottom: 0, borderBottomWidth: 0 },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.muted },
  link: { color: colors.accent, fontWeight: "700" },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.accent, backgroundColor: colors.bg, borderRadius: 8, padding: spacing.sm },
  quoteText: { fontSize: 13, lineHeight: 19, color: colors.ink, fontStyle: "italic" },
  libs: { borderRadius: 14, backgroundColor: colors.bg, paddingHorizontal: spacing.sm },
  lib: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  libLast: { borderBottomWidth: 0 },
  libText: { flex: 1 },
  libName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  libMeta: { fontSize: 12, color: colors.muted },
  license: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  toggle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, paddingVertical: 4 },
  toggleText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  mit: { fontSize: 12, lineHeight: 18, color: colors.muted },
  copyright: { marginTop: spacing.lg, fontSize: 12, color: colors.muted, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
