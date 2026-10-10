import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { ComponentProps, ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AboutContent, api } from "../api/client";
import { colors, fonts, shadow, spacing } from "../theme";

/** Wording required by the CEFR-J licence; keep it verbatim (backend/data/sources/README.md). Not editable in the admin web. */
const CEFRJ_CITATION =
  "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://www.cefr-j.org/download.html on 08/10/2026.";
const CEFRJ_URL = "https://www.cefr-j.org/download.html";

const FALLBACK_TAGLINE =
  "Học từ vựng và ngữ pháp tiếng Anh từ A1 đến B2 cho người Việt: ôn tập cách quãng, luyện nghe và luyện phát âm.";

type Icon = ComponentProps<typeof Ionicons>["name"];
type AboutItem = AboutContent["sections"][number]["items"][number];

const iconName = (name: string): Icon => (name in Ionicons.glyphMap ? (name as Icon) : "information-circle-outline");

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<AboutContent | null>(null);
  const [failed, setFailed] = useState(false);
  const version = Constants.expoConfig?.version ?? "1.0.0";

  useEffect(() => {
    api
      .about()
      .then(setContent)
      .catch(() => setFailed(true));
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.hero}>
        <Image source={require("../../assets/logo-emblem.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>4UME</Text>
        <Text style={styles.version}>Phiên bản {version}</Text>
        <Text style={styles.tagline}>{content?.tagline || FALLBACK_TAGLINE}</Text>
      </View>

      {!content && !failed ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : null}

      {content?.sections.map((section, si) => (
        <Section key={si} title={section.title}>
          {section.items.map((item, ii) => (
            <Item key={ii} item={item} last={ii === section.items.length - 1} />
          ))}
        </Section>
      ))}

      <Section title="Nguồn dữ liệu">
        <Text style={styles.body}>Danh sách từ và cấp độ CEFR dùng theo giấy phép của CEFR-J, có trích dẫn:</Text>
        <Pressable onPress={() => Linking.openURL(CEFRJ_URL)} style={({ pressed }) => [styles.quote, pressed && styles.pressed]}>
          <Text style={styles.quoteText}>{CEFRJ_CITATION}</Text>
        </Pressable>
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

function Item({ item, last }: { item: AboutItem; last: boolean }) {
  const url = item.url;
  return (
    <Pressable
      disabled={!url}
      onPress={url ? () => Linking.openURL(url) : undefined}
      style={({ pressed }) => [styles.item, last && styles.itemLast, pressed && styles.pressed]}
    >
      <View style={styles.itemIcon}>
        <Ionicons name={iconName(item.icon)} size={18} color={colors.accent} />
      </View>
      <View style={styles.itemText}>
        <View style={styles.itemHead}>
          <Text style={[styles.itemTitle, url ? styles.link : null]}>{item.title}</Text>
          {url ? <Ionicons name="open-outline" size={14} color={colors.accent} /> : null}
        </View>
        {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
      </View>
    </Pressable>
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
  loading: { marginTop: spacing.lg },
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
  itemHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.muted },
  link: { color: colors.accent },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.accent, backgroundColor: colors.bg, borderRadius: 8, padding: spacing.sm },
  quoteText: { fontSize: 13, lineHeight: 19, color: colors.ink, fontStyle: "italic" },
  copyright: { marginTop: spacing.lg, fontSize: 12, color: colors.muted, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
