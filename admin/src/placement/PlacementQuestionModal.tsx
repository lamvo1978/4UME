import { ActionIcon, Alert, Button, Checkbox, Group, Modal, Radio, Select, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core";
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
    setQ({ ...initial, acceptedAnswers: initial.acceptedAnswers ?? [], options: initial.options.length ? initial.options : ["", "", ""] });
    setError("");
  }, [opened, initial]);

  const set = (patch: Partial<PlacementGrammarInput>) => setQ((s) => ({ ...s, ...patch }));
  const setOption = (i: number, value: string) =>
    setQ((s) => {
      const old = s.options[i];
      const options = s.options.map((o, j) => (j === i ? value : o));
      const acceptedAnswers = (s.acceptedAnswers ?? []).map((a) => (a === old ? value : a)).filter((a) => a && a !== s.answer);
      return { ...s, options, acceptedAnswers, answer: s.answer === old ? value : s.answer };
    });

  const toggleAlso = (opt: string, on: boolean) =>
    setQ((s) => {
      const extra = new Set(s.acceptedAnswers ?? []);
      if (on) extra.add(opt);
      else extra.delete(opt);
      extra.delete(s.answer);
      return { ...s, acceptedAnswers: [...extra] };
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
        <Radio.Group
          label="Lựa chọn"
          description="Chấm tròn = đáp án chính; tick “Cũng đúng” khi bài dạy nhiều cách (will / be going to…)"
          value={q.answer}
          onChange={(v) =>
            setQ((s) => ({
              ...s,
              answer: v,
              acceptedAnswers: (s.acceptedAnswers ?? []).filter((a) => a !== v),
            }))
          }
        >
          <Stack gap={6} mt={6}>
            {q.options.map((o, i) => (
              <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
                <Radio mt={8} value={o} disabled={!o.trim()} aria-label={`Đáp án chính ${i + 1}`} />
                <Stack gap={4} style={{ flex: 1 }}>
                  <TextInput value={o} onChange={(e) => setOption(i, e.currentTarget.value)} placeholder={`Lựa chọn ${i + 1}`} />
                  {o.trim() && o !== q.answer ? (
                    <Checkbox
                      size="xs"
                      label="Cũng đúng"
                      checked={(q.acceptedAnswers ?? []).includes(o)}
                      onChange={(e) => toggleAlso(o, e.currentTarget.checked)}
                    />
                  ) : null}
                </Stack>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  mt={4}
                  disabled={q.options.length <= 3}
                  onClick={() =>
                    setQ((s) => ({
                      ...s,
                      options: s.options.filter((_, j) => j !== i),
                      answer: s.answer === o ? "" : s.answer,
                      acceptedAnswers: (s.acceptedAnswers ?? []).filter((a) => a !== o),
                    }))
                  }
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
