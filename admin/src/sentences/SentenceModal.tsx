import { Alert, Button, Group, Modal, Select, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import type { PlacementLevel, SentenceInput } from "../api";
import { PLACEMENT_LEVELS } from "../placement/meta";

type Props = {
  opened: boolean;
  onClose: () => void;
  /** Existing sentence, or the defaults of a new one. */
  initial: SentenceInput;
  title: string;
  /** True when the sentence already has audio, so changing the English makes it stale. */
  hasAudio: boolean;
  onSave: (s: SentenceInput) => Promise<void>;
};

export function SentenceModal({ opened, onClose, initial, title, hasAudio, onSave }: Props) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opened) return;
    setS(initial);
    setError("");
  }, [opened, initial]);

  const set = (patch: Partial<SentenceInput>) => setS((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave(s);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const enChanged = hasAudio && s.en.trim() !== initial.en.trim();

  return (
    <Modal opened={opened} onClose={busy ? () => {} : onClose} title={title} size="lg" radius="lg">
      <Stack>
        <Group grow>
          <Select label="Cấp độ" data={PLACEMENT_LEVELS} value={s.level} allowDeselect={false} onChange={(v) => set({ level: v as PlacementLevel })} />
          <TextInput label="Chủ đề" placeholder="vd: travel, work, food" value={s.topic ?? ""} onChange={(e) => set({ topic: e.currentTarget.value })} />
        </Group>
        <Textarea
          label="Câu tiếng Anh"
          description="Một câu hoàn chỉnh, dễ nghe, dễ viết: không tên riêng khó, không viết số bằng chữ số"
          autosize
          minRows={2}
          value={s.en}
          onChange={(e) => set({ en: e.currentTarget.value })}
        />
        {enChanged ? (
          <Text fz="xs" c="orange.8">
            Đổi câu tiếng Anh thì giọng đọc cũ không dùng được nữa — nhớ bấm “Tạo giọng đọc” sau khi lưu.
          </Text>
        ) : null}
        <Textarea label="Nghĩa tiếng Việt" autosize minRows={2} value={s.vi} onChange={(e) => set({ vi: e.currentTarget.value })} />
        <Switch label="Dùng trong app" checked={s.published} onChange={(e) => set({ published: e.currentTarget.checked })} />
        {error ? <Alert color="red">{error}</Alert> : null}
        <Group justify="flex-end">
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
