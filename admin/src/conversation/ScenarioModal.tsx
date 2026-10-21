import { Alert, Button, Group, Modal, Select, Stack, Switch, TagsInput, TextInput, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";
import type { PlacementLevel, ScenarioInput } from "../api";
import { PLACEMENT_LEVELS } from "../placement/meta";

type Props = {
  opened: boolean;
  onClose: () => void;
  /** Existing scenario, or the defaults of a new one. */
  initial: ScenarioInput;
  title: string;
  onSave: (s: ScenarioInput) => Promise<void>;
};

export function ScenarioModal({ opened, onClose, initial, title, onSave }: Props) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opened) return;
    setS(initial);
    setError("");
  }, [opened, initial]);

  const set = (patch: Partial<ScenarioInput>) => setS((x) => ({ ...x, ...patch }));

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

  return (
    <Modal opened={opened} onClose={busy ? () => {} : onClose} title={title} size="lg" radius="lg">
      <Stack>
        <Group grow>
          <Select label="Cấp độ" data={PLACEMENT_LEVELS} value={s.level} allowDeselect={false} onChange={(v) => set({ level: v as PlacementLevel })} />
          <TextInput
            label="Biểu tượng"
            description="Tên Ionicons, vd cafe-outline"
            value={s.icon ?? ""}
            onChange={(e) => set({ icon: e.currentTarget.value })}
          />
        </Group>
        <TextInput label="Tiêu đề (tiếng Việt)" placeholder="vd: Gọi đồ uống ở quán cà phê" value={s.titleVi} onChange={(e) => set({ titleVi: e.currentTarget.value })} />
        <Textarea
          label="Mục tiêu cho người học (tiếng Việt)"
          description="Hiện trong app, AI cũng dựa vào đây để biết khi nào người học hoàn thành"
          autosize
          minRows={1}
          value={s.goalVi}
          onChange={(e) => set({ goalVi: e.currentTarget.value })}
        />
        <Textarea
          label="Bối cảnh cho AI (tiếng Anh)"
          description="Chỉ AI đọc: nơi chốn, chuyện đang diễn ra"
          autosize
          minRows={2}
          value={s.situation}
          onChange={(e) => set({ situation: e.currentTarget.value })}
        />
        <TextInput label="Vai của AI (tiếng Anh)" placeholder="vd: a friendly barista" value={s.aiRole} onChange={(e) => set({ aiRole: e.currentTarget.value })} />
        <Textarea
          label="Câu mở đầu của AI (tiếng Anh)"
          description="Câu đầu tiên AI nói, nên kết thúc bằng một câu hỏi"
          autosize
          minRows={1}
          value={s.opening}
          onChange={(e) => set({ opening: e.currentTarget.value })}
        />
        <TagsInput
          label="Cụm từ gợi ý"
          description="Enter để thêm; tối đa 8 cụm"
          maxTags={8}
          splitChars={[]}
          value={s.keyPhrases}
          onChange={(v) => set({ keyPhrases: v })}
        />
        <Switch label="Hiện trong app" checked={s.published} onChange={(e) => set({ published: e.currentTarget.checked })} />
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
