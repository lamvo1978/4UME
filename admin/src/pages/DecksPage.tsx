import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Combobox,
  Group,
  InputBase,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  useCombobox,
} from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconPencil, IconPlus } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminDeck, type SaveDeck } from "../api";
import { DeckIcon } from "../components/DeckIcon";
import { notifyError, notifySaved } from "../lib";

/** Common Ionicons for topics; any other Ionicons name can be typed in. */
const ICONS = [
  "chatbubbles-outline", "time-outline", "people-outline", "restaurant-outline", "alarm-outline", "bus-outline",
  "cart-outline", "home-outline", "medkit-outline", "briefcase-outline", "partly-sunny-outline", "color-wand-outline",
  "speedometer-outline", "walk-outline", "link-outline", "shirt-outline", "color-palette-outline", "paw-outline",
  "business-outline", "happy-outline", "airplane-outline", "school-outline", "laptop-outline", "game-controller-outline",
  "musical-notes-outline", "leaf-outline", "library-outline", "football-outline", "car-outline", "book-outline",
  "globe-outline", "heart-outline", "cafe-outline", "film-outline", "fitness-outline", "flask-outline", "hammer-outline",
  "planet-outline", "rocket-outline", "storefront-outline", "trophy-outline", "water-outline", "albums-outline",
];

export function DecksPage() {
  const queryClient = useQueryClient();
  const decks = useQuery({ queryKey: ["decks"], queryFn: api.decks });
  const [editing, setEditing] = useState<AdminDeck | "new" | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["decks"] });
    queryClient.invalidateQueries({ queryKey: ["meta"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  async function move(index: number, delta: number) {
    const list = [...(decks.data ?? [])];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    queryClient.setQueryData(["decks"], list);
    try {
      await api.reorderDecks(list.map((d) => d.id));
      refresh();
    } catch (e) {
      notifyError(e);
      refresh();
    }
  }

  return (
    <Stack gap="md" maw={900}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Bộ từ</Title>
          <Text c="dimmed" fz="sm">
            Thứ tự ở đây là thứ tự hiện trong app.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing("new")}>
          Thêm bộ
        </Button>
      </Group>

      {decks.error ? <Alert color="red">{(decks.error as Error).message}</Alert> : null}
      {decks.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {decks.data?.map((d, i) => (
          <Paper key={d.id} p="sm" radius="lg" shadow="xs" style={{ opacity: d.published ? 1 : 0.6 }}>
            <Group wrap="nowrap" gap="sm">
              <Stack gap={2}>
                <ActionIcon variant="subtle" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Lên">
                  <IconArrowUp size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  disabled={i === (decks.data?.length ?? 0) - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Xuống"
                >
                  <IconArrowDown size={16} />
                </ActionIcon>
              </Stack>
              <DeckIcon name={d.icon} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6}>
                  <Text fw={700} truncate>
                    {d.titleVi}
                  </Text>
                  {!d.published ? (
                    <Badge size="sm" color="gray">
                      Đã ẩn
                    </Badge>
                  ) : null}
                </Group>
                <Text fz="sm" c="dimmed">
                  <Link to={`/words?deck=${d.id}`} style={{ color: "inherit" }}>
                    {d.wordCount} từ
                  </Link>
                  {d.hiddenWords ? ` (${d.hiddenWords} ẩn)` : ""}
                  {d.levels ? ` · ${d.levels.replaceAll(",", ", ")}` : ""} · <code>{d.id}</code>
                </Text>
              </div>
              <ActionIcon variant="light" size="lg" onClick={() => setEditing(d)} aria-label="Sửa">
                <IconPencil size={18} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}
      </Stack>

      {editing ? (
        <DeckModal
          deck={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
    </Stack>
  );
}

function DeckModal({ deck, onClose, onSaved }: { deck: AdminDeck | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SaveDeck>({
    id: deck?.id ?? "",
    titleVi: deck?.titleVi ?? "",
    icon: deck?.icon ?? "albums-outline",
    published: deck?.published ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (deck) await api.updateDeck(deck.id, form);
      else await api.createDeck(form);
      notifySaved();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deck || !window.confirm(`Xoá bộ "${deck.titleVi}"?`)) return;
    try {
      await api.deleteDeck(deck.id);
      notifySaved("Đã xoá bộ");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal opened onClose={onClose} title={deck ? "Sửa bộ từ" : "Thêm bộ từ"}>
      <Stack>
        {error ? <Alert color="red">{error}</Alert> : null}
        <TextInput
          label="Tên bộ"
          required
          value={form.titleVi}
          onChange={(e) => setForm({ ...form, titleVi: e.currentTarget.value })}
        />
        {!deck ? (
          <TextInput
            label="Mã bộ"
            description="Không đổi được sau khi tạo. Để trống sẽ tự tạo từ tên bộ."
            placeholder="vd: sports"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.currentTarget.value })}
          />
        ) : null}
        <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
        <Switch
          label="Hiện trong app"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.currentTarget.checked })}
        />
        <Group justify="space-between">
          {deck ? (
            <Button
              variant="subtle"
              color="red"
              onClick={remove}
              disabled={deck.wordCount > 0}
              title={deck.wordCount > 0 ? "Chỉ xoá được bộ không còn từ nào" : undefined}
            >
              Xoá bộ
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} loading={busy}>
            Lưu
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState(value);
  const filtered = ICONS.filter((i) => i.includes(search.trim().toLowerCase()) || search === value);

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(v) => {
        onChange(v);
        setSearch(v);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label="Biểu tượng"
          description="Tên biểu tượng Ionicons (ionic.io/ionicons)"
          leftSection={<DeckIcon name={value} size={28} />}
          leftSectionWidth={44}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            onChange(e.currentTarget.value.trim());
            combobox.openDropdown();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options mah={260} style={{ overflowY: "auto" }}>
          {filtered.map((i) => (
            <Combobox.Option value={i} key={i}>
              <Group gap="sm">
                <DeckIcon name={i} size={28} />
                <Text fz="sm">{i}</Text>
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
