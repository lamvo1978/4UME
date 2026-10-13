import { ActionIcon, Alert, Button, Group, Modal, Radio, Select, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AdminGrammarSummary, PlacementGrammarInput, PlacementLevel } from "../api";
import { PLACEMENT_LEVELS } from "./meta";

type Props = {
  opened: boolean;
  onClose: () => void;
  /** Existing question, or the defaults of a new one. */
  initial: PlacementGrammarInput;
  title: string;
  lessons: AdminGrammarSummary[];
  onSave: (q: PlacementGrammarInput) => Promise<void>;
};

const MAX_OPTIONS = 4;

export function PlacementQuestionModal({ opened, onClose, initial, title, lessons, onSave }: Props) {
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opened) return;
    setQ({ ...initial, options: initial.options.length ? initial.options : ["", "", ""] });
    setError("");
  }, [opened, initial]);

  const set = (patch: Partial<PlacementGrammarInput>) => setQ((s) => ({ ...s, ...patch }));
  const setOption = (i: number, value: string) =>
    setQ((s) => {
      const options = s.options.map((o, j) => (j === i ? value : o));
      return { ...s, options, answer: s.answer === s.options[i] ? value : s.answer };
    });

  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const levelLessons = lessons.filter((l) => l.level === q.level);

  return (
    <Modal opened={opened} onClose={busy ? () => {} : onClose} title={title} size="lg" radius="lg">
      <Stack>
        <Group grow>
          <Select
            label="Cấp độ"
            data={PLACEMENT_LEVELS}
            value={q.level}
            allowDeselect={false}
            onChange={(v) => set({ level: v as PlacementLevel, lessonSlug: null })}
          />
          <Select
            label="Kiểm tra bài"
            description="Sai câu này → gợi ý bắt đầu từ bài đó"
            placeholder="Không gắn bài"
            clearable
            searchable
            data={levelLessons.map((l) => ({ value: l.slug, label: l.titleVi }))}
            value={q.lessonSlug}
            onChange={(v) => set({ lessonSlug: v })}
          />
        </Group>
        <Textarea
          label="Câu hỏi"
          description='Câu có ___ ở chỗ trống, hoặc "Chọn câu đúng." khi các lựa chọn là cả câu'
          autosize
          minRows={2}
          value={q.prompt}
          onChange={(e) => set({ prompt: e.currentTarget.value })}
        />
        <Radio.Group label="Lựa chọn" description="Chấm tròn = đáp án đúng" value={q.answer} onChange={(v) => set({ answer: v })}>
          <Stack gap={6} mt={6}>
            {q.options.map((o, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <Radio value={o} disabled={!o.trim()} aria-label={`Đáp án ${i + 1}`} />
                <TextInput style={{ flex: 1 }} value={o} onChange={(e) => setOption(i, e.currentTarget.value)} placeholder={`Lựa chọn ${i + 1}`} />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  disabled={q.options.length <= 3}
                  onClick={() => set({ options: q.options.filter((_, j) => j !== i), answer: q.answer === o ? "" : q.answer })}
                  aria-label="Xoá lựa chọn"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            {q.options.length < MAX_OPTIONS ? (
              <Button variant="subtle" size="xs" w="fit-content" leftSection={<IconPlus size={14} />} onClick={() => set({ options: [...q.options, ""] })}>
                Thêm lựa chọn
              </Button>
            ) : null}
          </Stack>
        </Radio.Group>
        <Textarea
          label="Giải thích (chỉ để biên tập)"
          autosize
          minRows={1}
          value={q.explanationVi ?? ""}
          onChange={(e) => set({ explanationVi: e.currentTarget.value })}
        />
        <Switch label="Dùng trong bài kiểm tra" checked={q.published} onChange={(e) => set({ published: e.currentTarget.checked })} />
        {error ? <Alert color="red">{error}</Alert> : null}
        <Group justify="flex-end">
          <Text fz="xs" c="dimmed" mr="auto">
            Thứ tự lựa chọn được xáo khi hiện trong app.
          </Text>
          <Button variant="default" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={save} loading={busy}>
            Lưu
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
