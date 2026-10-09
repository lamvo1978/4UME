import { ActionIcon, Box, Button, Group, Paper, Stack, TagsInput, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconColumnInsertRight, IconColumnRemove, IconPlus, IconRowInsertBottom, IconTrash, IconX } from "@tabler/icons-react";
import type { Bilingual, GrammarSection } from "../api";
import { Select } from "../components/AppSelect";
import { FORMULA_KINDS, move } from "./meta";

type Props = { section: GrammarSection; onChange: (s: GrammarSection) => void };

export function SectionBodyEditor({ section: s, onChange }: Props) {
  switch (s.type) {
    case "usage":
      return (
        <ItemList
          items={s.items ?? []}
          onChange={(items) => onChange({ ...s, items })}
          blank={{ textVi: "", example: { en: "", vi: "" } }}
          addLabel="Thêm ý"
          render={(it, set) => (
            <Stack gap={6}>
              <Textarea autosize minRows={1} placeholder="Cách dùng (tiếng Việt)" value={it.textVi ?? ""} onChange={(e) => set({ ...it, textVi: e.currentTarget.value })} />
              <ExampleFields value={it.example} onChange={(example) => set({ ...it, example })} />
            </Stack>
          )}
        />
      );
    case "formula":
      return (
        <ItemList
          items={s.rows ?? []}
          onChange={(rows) => onChange({ ...s, rows })}
          blank={{ kind: "affirmative", pattern: "", example: { en: "", vi: "" } }}
          addLabel="Thêm dòng công thức"
          render={(r, set) => (
            <Stack gap={6}>
              <Group gap={6} wrap="nowrap" align="flex-start">
                <Select w={150} data={FORMULA_KINDS} value={r.kind} allowDeselect={false} onChange={(v) => v && set({ ...r, kind: v })} />
                <Textarea style={{ flex: 1 }} autosize minRows={1} placeholder="S + am / is / are + V-ing" value={r.pattern} onChange={(e) => set({ ...r, pattern: e.currentTarget.value })} />
              </Group>
              <ExampleFields value={r.example} onChange={(example) => set({ ...r, example })} />
            </Stack>
          )}
        />
      );
    case "table":
      return <TableEditor section={s} onChange={onChange} />;
    case "examples":
      return (
        <ItemList
          items={s.items ?? []}
          onChange={(items) => onChange({ ...s, items })}
          blank={{ en: "", vi: "" }}
          addLabel="Thêm ví dụ"
          render={(it, set) => <ExampleFields value={{ en: it.en ?? "", vi: it.vi ?? "" }} onChange={(e) => set({ ...it, en: e.en, vi: e.vi })} />}
        />
      );
    case "signals":
      return (
        <TagsInput
          placeholder="Gõ rồi Enter (vd: every day)"
          description="Mỗi từ / cụm từ là một thẻ. Dấu phẩy cũng tách thẻ."
          value={s.words ?? []}
          onChange={(words) => onChange({ ...s, words })}
          splitChars={[","]}
          clearable
        />
      );
    case "mistakes":
      return (
        <ItemList
          items={s.items ?? []}
          onChange={(items) => onChange({ ...s, items })}
          blank={{ wrong: "", right: "", noteVi: "" }}
          addLabel="Thêm lỗi"
          render={(m, set) => (
            <Stack gap={6}>
              <Group grow gap={6} wrap="nowrap">
                <TextInput placeholder="Câu sai" styles={{ input: { color: "#C92A2A" } }} value={m.wrong ?? ""} onChange={(e) => set({ ...m, wrong: e.currentTarget.value })} />
                <TextInput placeholder="Câu đúng" styles={{ input: { color: "#0F6B5C", fontWeight: 600 } }} value={m.right ?? ""} onChange={(e) => set({ ...m, right: e.currentTarget.value })} />
              </Group>
              <TextInput placeholder="Giải thích ngắn (tuỳ chọn)" value={m.noteVi ?? ""} onChange={(e) => set({ ...m, noteVi: e.currentTarget.value })} />
            </Stack>
          )}
        />
      );
    default:
      return <Textarea autosize minRows={2} placeholder="Nội dung mẹo / lưu ý" value={s.textVi ?? ""} onChange={(e) => onChange({ ...s, textVi: e.currentTarget.value })} />;
  }
}

function ExampleFields({ value, onChange }: { value?: Bilingual | null; onChange: (v: Bilingual) => void }) {
  const v = value ?? { en: "", vi: "" };
  return (
    <Group grow gap={6} wrap="nowrap" align="flex-start">
      <TextInput placeholder="Ví dụ tiếng Anh" value={v.en} onChange={(e) => onChange({ ...v, en: e.currentTarget.value })} styles={{ input: { fontStyle: "italic" } }} />
      <TextInput placeholder="Nghĩa tiếng Việt" value={v.vi} onChange={(e) => onChange({ ...v, vi: e.currentTarget.value })} />
    </Group>
  );
}

type ItemListProps<T> = {
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  addLabel: string;
  render: (item: T, set: (item: T) => void) => React.ReactNode;
};

/** A reorderable list of small sub-forms (usage points, formula rows, mistakes…). */
export function ItemList<T>({ items, onChange, blank, addLabel, render }: ItemListProps<T>) {
  return (
    <Stack gap="xs">
      {items.map((it, i) => (
        <Group key={i} gap={6} wrap="nowrap" align="flex-start">
          <Text fz="xs" c="dimmed" fw={700} w={18} pt={10} ta="right">
            {i + 1}
          </Text>
          <Box style={{ flex: 1, minWidth: 0 }}>{render(it, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}</Box>
          <Stack gap={0}>
            <ActionIcon variant="subtle" size="sm" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} aria-label="Lên">
              <IconArrowUp size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" size="sm" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} aria-label="Xuống">
              <IconArrowDown size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" size="sm" color="red" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Xoá dòng">
              <IconX size={14} />
            </ActionIcon>
          </Stack>
        </Group>
      ))}
      <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={() => onChange([...items, structuredClone(blank)])} style={{ alignSelf: "flex-start" }}>
        {addLabel}
      </Button>
    </Stack>
  );
}

function TableEditor({ section: s, onChange }: Props) {
  const headers = s.headers ?? [];
  const cells = s.cells ?? [];
  const cols = headers.length;
  const set = (h: string[], c: string[][]) => onChange({ ...s, headers: h, cells: c });

  return (
    <Stack gap="xs">
      <Box style={{ overflowX: "auto" }}>
        <Box style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(140px, 1fr)) 32px`, gap: 6, minWidth: cols * 146 + 32 }}>
          {headers.map((h, i) => (
            <TextInput
              key={`h${i}`}
              placeholder={`Cột ${i + 1}`}
              value={h}
              styles={{ input: { fontWeight: 700, background: "#DCEFE8" } }}
              onChange={(e) => set(headers.map((x, j) => (j === i ? e.currentTarget.value : x)), cells)}
              rightSection={
                cols > 1 ? (
                  <Tooltip label="Xoá cột">
                    <ActionIcon variant="subtle" size="sm" color="red" onClick={() => set(headers.filter((_, j) => j !== i), cells.map((r) => r.filter((_, j) => j !== i)))}>
                      <IconColumnRemove size={14} />
                    </ActionIcon>
                  </Tooltip>
                ) : null
              }
            />
          ))}
          <Tooltip label="Thêm cột">
            <ActionIcon variant="light" mt={6} onClick={() => set([...headers, ""], cells.map((r) => [...r, ""]))}>
              <IconColumnInsertRight size={16} />
            </ActionIcon>
          </Tooltip>
          {cells.map((row, r) => [
            ...Array.from({ length: cols }, (_, c) => (
              <Textarea
                key={`${r}-${c}`}
                autosize
                minRows={1}
                value={row[c] ?? ""}
                styles={{ input: { fontWeight: c === 0 ? 600 : undefined } }}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  set(headers, cells.map((x, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : (x[j] ?? ""))) : x)));
                }}
              />
            )),
            <Tooltip key={`d${r}`} label="Xoá dòng">
              <ActionIcon variant="subtle" color="red" mt={6} onClick={() => set(headers, cells.filter((_, i) => i !== r))}>
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>,
          ])}
        </Box>
      </Box>
      <Button variant="subtle" size="xs" leftSection={<IconRowInsertBottom size={14} />} onClick={() => set(headers, [...cells, Array(cols).fill("")])} style={{ alignSelf: "flex-start" }}>
        Thêm dòng
      </Button>
    </Stack>
  );
}

export function SectionCard({
  title,
  badge,
  problems,
  index,
  count,
  onMove,
  onRemove,
  children,
  extra,
}: {
  title: React.ReactNode;
  badge: React.ReactNode;
  problems?: string[];
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <Paper radius="lg" p="md" shadow="xs" withBorder={!!problems?.length} style={problems?.length ? { borderColor: "#F08C00" } : undefined}>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          {badge}
          {title}
        </Group>
        <Group gap={2} wrap="nowrap">
          {extra}
          <ActionIcon variant="subtle" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Lên">
            <IconArrowUp size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Xuống">
            <IconArrowDown size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="Xoá">
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
      {problems?.length ? (
        <Text fz="sm" c="orange.8" mb="xs">
          {problems.join(" ")}
        </Text>
      ) : null}
      {children}
    </Paper>
  );
}
