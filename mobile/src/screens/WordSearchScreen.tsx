import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, WordSearchResult } from "../api/client";
import { SpeakButton } from "../components/SpeakButton";
import { RootStackParamList } from "../navigation/types";
import { colors, shadow, spacing } from "../theme";
import { posLabel } from "../vocabulary/deckMeta";

const STATUS = { New: 0, Later: 1, Known: 2 } as const;
const DEBOUNCE_MS = 250;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WordSearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WordSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const seq = ++requestSeq.current;
    if (!q) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchWords(q);
        if (seq !== requestSeq.current) return;
        setResults(data);
        setError("");
        setOpenId(data.length === 1 ? data[0].word.id : null);
      } catch (e) {
        if (seq === requestSeq.current) setError(e instanceof Error ? e.message : "Lỗi tìm kiếm");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  async function setStatus(id: string, status: number) {
    await api.updateProgress(id, status);
    setResults((rs) => rs.map((r) => (r.word.id === id ? { ...r, word: { ...r.word, status } } : r)));
  }

  const q = query.trim();

  return (
    <View style={styles.root}>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Từ tiếng Anh hoặc nghĩa tiếng Việt"
          placeholderTextColor={colors.muted}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        {query && !loading ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={results}
        keyExtractor={(r) => r.word.id}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !q ? (
            <Hint
              icon="search-outline"
              title="Tìm lại từ bạn đã gặp"
              sub={'Chỉ tìm trong kho từ của 4UME. Gõ tiếng Anh ("apple") hoặc nghĩa tiếng Việt, có dấu hay không dấu đều được ("qua tao").'}
            />
          ) : loading ? null : (
            <Hint
              icon="help-circle-outline"
              title="Không có từ này trong kho"
              sub="Thử kiểm tra chính tả hoặc gõ một nghĩa khác."
            />
          )
        }
        renderItem={({ item }) => (
          <ResultCard
            item={item}
            open={openId === item.word.id}
            onToggle={() => setOpenId((id) => (id === item.word.id ? null : item.word.id))}
            onSetStatus={(s) => setStatus(item.word.id, s)}
            onPractice={() =>
              navigation.navigate("Review", { mode: "practice", wordIds: [item.word.id], title: item.word.word })
            }
            onOpenDeck={() => navigation.navigate("Flashcard", { deckId: item.deckId, titleVi: item.deckTitleVi })}
          />
        )}
      />
    </View>
  );
}

function Hint({ icon, title, sub }: { icon: "search-outline" | "help-circle-outline"; title: string; sub: string }) {
  return (
    <View style={styles.hint}>
      <Ionicons name={icon} size={40} color={colors.accent} />
      <Text style={styles.hintTitle}>{title}</Text>
      <Text style={styles.hintSub}>{sub}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: number }) {
  if (status === STATUS.Known)
    return <Text style={[styles.badge, styles.badgeKnown]}>Đã nhớ</Text>;
  if (status === STATUS.Later)
    return <Text style={[styles.badge, styles.badgeLater]}>Học sau</Text>;
  return null;
}

function ResultCard({
  item,
  open,
  onToggle,
  onSetStatus,
  onPractice,
  onOpenDeck,
}: {
  item: WordSearchResult;
  open: boolean;
  onToggle: () => void;
  onSetStatus: (status: number) => Promise<void>;
  onPractice: () => void;
  onOpenDeck: () => void;
}) {
  const w = item.word;
  const [busy, setBusy] = useState(false);

  async function change(status: number) {
    setBusy(true);
    try {
      await onSetStatus(status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onToggle}>
        <View style={styles.rowText}>
          {item.matchedForm ? (
            <Text style={styles.via}>
              “{item.matchedForm}” là một dạng của “{w.word}”
            </Text>
          ) : null}
          <Text style={styles.word}>
            {w.word} <Text style={styles.meta}>· {posLabel(w.pos)} · {w.level}</Text>
          </Text>
          <Text style={styles.meaning} numberOfLines={open ? undefined : 1}>
            {w.meaningVi}
          </Text>
        </View>
        <StatusBadge status={w.status} />
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>

      {open ? (
        <View style={styles.detail}>
          <View style={styles.ipaRow}>
            <SpeakButton text={w.word} size="sm" />
            <Text style={styles.ipa}>{w.ipa}</Text>
            {w.forms ? <Text style={styles.forms}>{w.forms}</Text> : null}
          </View>
          {w.example ? (
            <View style={styles.example}>
              <Text style={styles.exampleEn}>{w.example}</Text>
              <Text style={styles.exampleVi}>{w.exampleVi}</Text>
            </View>
          ) : null}
          <Pressable onPress={onOpenDeck} hitSlop={6}>
            <Text style={styles.deck}>
              Bộ “{item.deckTitleVi}” <Ionicons name="arrow-forward" size={13} color={colors.accent} />
            </Text>
          </Pressable>

          <View style={styles.actions}>
            {w.status === STATUS.Known ? (
              <>
                <Action label="Học lại" icon="refresh" disabled={busy} onPress={() => change(STATUS.Later)} />
                <Action label="Luyện ngay" icon="flash" primary disabled={busy} onPress={onPractice} />
              </>
            ) : (
              <>
                {w.status === STATUS.New ? (
                  <Action label="Học sau" icon="time-outline" disabled={busy} onPress={() => change(STATUS.Later)} />
                ) : null}
                <Action label="Đã nhớ" icon="checkmark" primary disabled={busy} onPress={() => change(STATUS.Known)} />
              </>
            )}
          </View>
          {w.status === STATUS.Later ? (
            <Text style={styles.note}>Từ này sẽ hiện đầu tiên khi bạn mở bộ “{item.deckTitleVi}”.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Action({
  label,
  icon,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  icon: "refresh" | "flash" | "time-outline" | "checkmark";
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionOutline,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.white : colors.accent} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink },
  list: { padding: spacing.lg, paddingTop: spacing.md, gap: 10 },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.lg },
  hint: { alignItems: "center", marginTop: 48, paddingHorizontal: spacing.lg, gap: 8 },
  hintTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  hintSub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 18, backgroundColor: colors.surface, ...shadow.card, shadowOpacity: 0.05 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  word: { fontSize: 17, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, fontWeight: "500", color: colors.muted },
  via: { fontSize: 12, fontWeight: "600", color: colors.flameDeep },
  meaning: { fontSize: 15, color: colors.ink },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeKnown: { backgroundColor: colors.accentSoft, color: colors.accent },
  badgeLater: { backgroundColor: colors.flameSoft, color: colors.flameDeep },
  detail: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  ipaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ipa: { fontSize: 15, color: colors.muted },
  forms: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "700", color: colors.flameDeep },
  example: { backgroundColor: colors.bg, borderRadius: 12, padding: 10, gap: 4 },
  exampleEn: { fontSize: 15, color: colors.ink, fontStyle: "italic" },
  exampleVi: { fontSize: 14, color: colors.muted },
  deck: { fontSize: 14, fontWeight: "600", color: colors.accent },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 12,
  },
  actionPrimary: { backgroundColor: colors.accent },
  actionOutline: { borderWidth: 1.5, borderColor: colors.accent },
  actionText: { fontSize: 15, fontWeight: "700", color: colors.accent },
  actionTextPrimary: { color: colors.white },
  note: { fontSize: 13, color: colors.muted },
});
