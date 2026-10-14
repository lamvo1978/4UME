import { Alert, Badge, Button, Checkbox, Group, Input, Modal, Paper, SegmentedControl, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type PlacementLevel, type SentenceDraft, type SentenceInput } from "../api";
import { AiProviderSelect, useAiProvider } from "../components/AiProviderSelect";
import { PLACEMENT_LEVELS } from "../placement/meta";

const COUNTS = ["5", "10", "15", "20"];

type Props = {
  opened: boolean;
  onClose: () => void;
  level: PlacementLevel;
  onAdd: (sentences: SentenceInput[]) => Promise<void>;
};

/** The AI drafts practice sentences for a level; the admin ticks the ones to save. */
export function SentenceDraftModal({ opened, onClose, level: initialLevel, onAdd }: Props) {
  const status = useQuery({ queryKey: ["listening-draft-status"], queryFn: api.listeningDraftStatus, enabled: opened, staleTime: 60_000 });
  const [level, setLevel] = useState<PlacementLevel>(initialLevel);
  const [count, setCount] = useState("10");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<SentenceDraft | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [provider, setProvider] = useAiProvider(status.data?.providers);

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
      const result = await api.draftSentences({
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
      await onAdd(draft.items.filter((_, i) => picked.has(i)).map((item) => item.sentence));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const notConfigured = status.data && !status.data.configured;
  const doubtful = draft?.items.filter((i) => i.duplicate || i.problems.length > 0).length ?? 0;

  return (
    <Modal opened={opened} onClose={busy || saving ? () => {} : onClose} title={`AI soạn câu luyện ${level}`} size="xl" radius="lg">
      {draft ? (
        <Stack>
          <Text fz="xs" c="dimmed">
            Soạn bởi {draft.model}
          </Text>
          {doubtful > 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
              {doubtful} câu bị trùng hoặc sai khuôn nên chưa được chọn.
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              Đọc lướt nghĩa tiếng Việt trước khi lưu nhé.
            </Text>
          )}
          <Stack gap="xs">
            {draft.items.map(({ sentence: s, problems, duplicate }, i) => {
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
                      aria-label={`Chọn câu ${i + 1}`}
                    />
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={6}>
                        <Text fz="sm" fw={600}>
                          {s.en}
                        </Text>
                        {s.topic ? (
                          <Badge variant="light" size="xs" tt="none">
                            {s.topic}
                          </Badge>
                        ) : null}
                      </Group>
                      <Text fz="sm" c="dimmed">
                        {s.vi}
                      </Text>
                      {duplicate ? (
                        <Text fz="xs" c="orange.8">
                          Đã có câu này trong ngân hàng.
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
              Lưu {picked.size} câu
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          {notConfigured ? (
            <Alert color="yellow" title="Chưa bật AI">
              Máy chủ chưa có <b>GROQ_API_KEY</b> hoặc <b>GEMINI_API_KEY</b> — xem docs/listening.md.
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              AI soạn câu tiếng Anh đời thường vừa sức cấp độ, kèm nghĩa tiếng Việt, tránh trùng câu đã có. Chỉ những câu bạn chọn mới được lưu.
            </Text>
          )}
          <Group grow align="flex-start">
            <Input.Wrapper label="Cấp độ">
              <SegmentedControl fullWidth data={PLACEMENT_LEVELS} value={level} onChange={(v) => setLevel(v as PlacementLevel)} />
            </Input.Wrapper>
            <Input.Wrapper label="Số câu">
              <SegmentedControl fullWidth data={COUNTS} value={count} onChange={setCount} />
            </Input.Wrapper>
          </Group>
          <TextInput
            label="Chủ đề (không bắt buộc)"
            placeholder="vd: travel, ở nhà hàng, đi khám bệnh"
            value={topic}
            onChange={(e) => setTopic(e.currentTarget.value)}
          />
          <Textarea
            label="Mong muốn thêm (không bắt buộc)"
            placeholder="vd: nhiều câu hỏi; dùng thì quá khứ"
            autosize
            minRows={2}
            maxRows={5}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <AiProviderSelect providers={status.data?.providers} value={provider} onChange={setProvider} />
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
