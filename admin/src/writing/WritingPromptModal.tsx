import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Switch, TagsInput, TextInput, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import type { PlacementLevel, WritingPromptInput } from "../api";
import { PLACEMENT_LEVELS } from "../placement/meta";

type Props = {
  opened: boolean;
  onClose: () => void;
  /** Existing prompt, or the defaults of a new one. */
  initial: WritingPromptInput;
  title: string;
  onSave: (p: WritingPromptInput) => Promise<void>;
};

const num = (v: string | number) => (typeof v === "number" ? v : 0);

export function WritingPromptModal({ opened, onClose, initial, title, onSave }: Props) {
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opened) return;
    setP(initial);
    setError("");
  }, [opened, initial]);

  const set = (patch: Partial<WritingPromptInput>) => setP((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave(p);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={busy ? () => {} : onClose} title={title} size="lg" radius="lg">
      <Stack>
        <Group grow>
          <Select label="Cấp độ" data={PLACEMENT_LEVELS} value={p.level} allowDeselect={false} onChange={(v) => set({ level: v as PlacementLevel })} />
          <TextInput
            label="Biểu tượng"
            description="Tên Ionicons, vd mail-outline"
            value={p.icon ?? ""}
            onChange={(e) => set({ icon: e.currentTarget.value })}
          />
        </Group>
        <TextInput label="Tiêu đề (tiếng Việt)" placeholder="vd: Giới thiệu bản thân" value={p.titleVi} onChange={(e) => set({ titleVi: e.currentTarget.value })} />
        <Textarea
          label="Đề bài (tiếng Anh)"
          description="Người học đọc đề này, AI cũng chấm theo đề này (có đúng đề, đủ ý không)"
          autosize
          minRows={2}
          value={p.promptEn}
          onChange={(e) => set({ promptEn: e.currentTarget.value })}
        />
        <Textarea
          label="Hướng dẫn (tiếng Việt)"
          description="Một câu ngắn: bài cần có những ý gì"
          autosize
          minRows={1}
          value={p.guideVi ?? ""}
          onChange={(e) => set({ guideVi: e.currentTarget.value })}
        />
        <Group grow>
          <NumberInput label="Số từ gợi ý · tối thiểu" description="0 = theo cấp độ" min={0} max={400} value={p.minWords} onChange={(v) => set({ minWords: num(v) })} />
          <NumberInput label="Số từ gợi ý · tối đa" description="0 = theo cấp độ" min={0} max={400} value={p.maxWords} onChange={(v) => set({ maxWords: num(v) })} />
        </Group>
        <TagsInput
          label="Cụm từ gợi ý"
          description="Enter để thêm; tối đa 8 cụm"
          maxTags={8}
          splitChars={[]}
          value={p.keyPhrases}
          onChange={(v) => set({ keyPhrases: v })}
        />
        <Switch label="Hiện trong app" checked={p.published} onChange={(e) => set({ published: e.currentTarget.checked })} />
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
