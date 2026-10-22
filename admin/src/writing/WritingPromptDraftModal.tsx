import { Alert, Button, Checkbox, Group, Input, Modal, Paper, SegmentedControl, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api, type AiProvider, type PlacementLevel, type WritingPromptDraft, type WritingPromptInput } from "../api";
import { AiProviderSelect, useAiProvider } from "../components/AiProviderSelect";
import { PLACEMENT_LEVELS } from "../placement/meta";

const COUNTS = ["3", "5", "8", "10"];

type Props = {
  opened: boolean;
  onClose: () => void;
  level: PlacementLevel;
  providers: AiProvider[] | undefined;
  onAdd: (prompts: WritingPromptInput[]) => Promise<void>;
};

/** The AI drafts writing tasks for a level; the admin ticks the ones to save. */
export function WritingPromptDraftModal({ opened, onClose, level: initialLevel, providers, onAdd }: Props) {
  const [level, setLevel] = useState<PlacementLevel>(initialLevel);
  const [count, setCount] = useState("5");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<WritingPromptDraft | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [provider, setProvider] = useAiProvider(providers);

  useEffect(() => {
    if (!opened) return;
    setLevel(initialLevel);
    setDraft(null);
    setError("");
  }, [opened, initialLevel]);

  async function write() {
    setBusy(true);
    setError("");
    try {
      const result = await api.draftWritingPrompts({
        level,
        count: Number(count),
        topic: topic.trim() || undefined,
        notes: notes.trim() || undefined,
        provider: provider || undefined,
      });
      setDraft(result);
      setPicked(new Set(result.items.flatMap((item, i) => (item.problems.length === 0 && !item.duplicate ? [i] : []))));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(draft.items.filter((_, i) => picked.has(i)).map((item) => item.prompt));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const notConfigured = providers !== undefined && !providers.some((p) => p.configured);
  const doubtful = draft?.items.filter((i) => i.duplicate || i.problems.length > 0).length ?? 0;

  return (
    <Modal opened={opened} onClose={busy || saving ? () => {} : onClose} title={`AI soạn đề viết ${level}`} size="xl" radius="lg">
      {draft ? (
        <Stack>
          <Text fz="xs" c="dimmed">
            Soạn bởi {draft.model}
          </Text>
          {doubtful > 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
              {doubtful} đề bị trùng hoặc sai khuôn nên chưa được chọn.
            </Alert>
          ) : null}
          <Stack gap="xs">
            {draft.items.map(({ prompt: p, problems, duplicate }, i) => {
              const on = picked.has(i);
              return (
                <Paper key={i} withBorder radius="md" p="sm" style={{ borderColor: duplicate || problems.length ? "#F08C00" : undefined }}>
                  <Group align="flex-start" wrap="nowrap" gap="sm">
                    <Checkbox
                      mt={2}
                      checked={on}
                      onChange={() =>
                        setPicked((x) => {
                          const next = new Set(x);
                          if (on) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                      aria-label={`Chọn đề ${i + 1}`}
                    />
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Text fz="sm" fw={600}>
                        {p.titleVi} · {p.minWords}–{p.maxWords} từ
                      </Text>
                      <Text fz="sm">{p.promptEn}</Text>
                      {p.guideVi ? (
                        <Text fz="xs" c="dimmed">
                          {p.guideVi}
                        </Text>
                      ) : null}
                      {p.keyPhrases.length ? (
                        <Text fz="xs" c="dimmed">
                          Gợi ý: {p.keyPhrases.join(" · ")}
                        </Text>
                      ) : null}
                      {duplicate ? (
                        <Text fz="xs" c="orange.8">
                          Đã có đề cùng tên.
                        </Text>
                      ) : null}
                      {problems.length ? (
                        <Text fz="xs" c="red.7">
                          Sai khuôn: {problems.join(" ")}
                        </Text>
                      ) : null}
                    </Stack>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="space-between">
            <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => setDraft(null)} disabled={saving}>
              Soạn lại
            </Button>
            <Button onClick={add} disabled={picked.size === 0} loading={saving}>
              Lưu {picked.size} đề
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          {notConfigured ? (
            <Alert color="yellow" title="Chưa bật AI">
              Máy chủ chưa có <b>GROQ_API_KEY</b>, <b>GEMINI_API_KEY</b> hoặc <b>MISTRAL_API_KEY</b>.
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              AI soạn đề viết vừa sức cấp độ (đề tiếng Anh, hướng dẫn, số từ gợi ý, cụm từ gợi ý), tránh trùng đề đã có. Chỉ những đề bạn chọn mới được lưu.
            </Text>
          )}
          <Group grow align="flex-start">
            <Input.Wrapper label="Cấp độ">
              <SegmentedControl fullWidth data={PLACEMENT_LEVELS} value={level} onChange={(v) => setLevel(v as PlacementLevel)} />
            </Input.Wrapper>
            <Input.Wrapper label="Số đề">
              <SegmentedControl fullWidth data={COUNTS} value={count} onChange={setCount} />
            </Input.Wrapper>
          </Group>
          <TextInput
            label="Chủ đề (không bắt buộc)"
            placeholder="vd: công việc, du lịch, email"
            value={topic}
            onChange={(e) => setTopic(e.currentTarget.value)}
          />
          <Textarea
            label="Mong muốn thêm (không bắt buộc)"
            placeholder="vd: đề luyện viết email cho người đi làm"
            autosize
            minRows={2}
            maxRows={5}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <AiProviderSelect providers={providers} value={provider} onChange={setProvider} />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Huỷ
            </Button>
            <Button leftSection={<IconSparkles size={18} />} onClick={write} loading={busy} disabled={notConfigured}>
              Soạn bằng AI
            </Button>
          </Group>
          {busy ? (
            <Text size="xs" c="dimmed" ta="right">
              Soạn thường mất 10–30 giây…
            </Text>
          ) : null}
        </Stack>
      )}
    </Modal>
  );
}
