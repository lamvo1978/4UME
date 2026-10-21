import { Alert, Badge, Button, Checkbox, Group, Input, Modal, Paper, SegmentedControl, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api, type AiProvider, type PlacementLevel, type ScenarioDraft, type ScenarioInput } from "../api";
import { AiProviderSelect, useAiProvider } from "../components/AiProviderSelect";
import { PLACEMENT_LEVELS } from "../placement/meta";

const COUNTS = ["3", "5", "8", "10"];

type Props = {
  opened: boolean;
  onClose: () => void;
  level: PlacementLevel;
  providers: AiProvider[] | undefined;
  onAdd: (scenarios: ScenarioInput[]) => Promise<void>;
};

/** The AI drafts role-play situations for a level; the admin ticks the ones to save. */
export function ScenarioDraftModal({ opened, onClose, level: initialLevel, providers, onAdd }: Props) {
  const [level, setLevel] = useState<PlacementLevel>(initialLevel);
  const [count, setCount] = useState("5");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ScenarioDraft | null>(null);
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
      const result = await api.draftScenarios({
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
      await onAdd(draft.items.filter((_, i) => picked.has(i)).map((item) => item.scenario));
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
    <Modal opened={opened} onClose={busy || saving ? () => {} : onClose} title={`AI soạn tình huống ${level}`} size="xl" radius="lg">
      {draft ? (
        <Stack>
          <Text fz="xs" c="dimmed">
            Soạn bởi {draft.model}
          </Text>
          {doubtful > 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
              {doubtful} tình huống bị trùng hoặc sai khuôn nên chưa được chọn.
            </Alert>
          ) : null}
          <Stack gap="xs">
            {draft.items.map(({ scenario: s, problems, duplicate }, i) => {
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
                      aria-label={`Chọn tình huống ${i + 1}`}
                    />
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={6}>
                        <Text fz="sm" fw={600}>
                          {s.titleVi}
                        </Text>
                        <Badge variant="light" size="xs" tt="none">
                          {s.aiRole}
                        </Badge>
                      </Group>
                      <Text fz="sm">{s.goalVi}</Text>
                      <Text fz="sm" c="dimmed" fs="italic">
                        “{s.opening}”
                      </Text>
                      <Text fz="xs" c="dimmed">
                        {s.situation}
                      </Text>
                      {s.keyPhrases.length ? (
                        <Text fz="xs" c="dimmed">
                          Gợi ý: {s.keyPhrases.join(" · ")}
                        </Text>
                      ) : null}
                      {duplicate ? (
                        <Text fz="xs" c="orange.8">
                          Đã có tình huống cùng tên.
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
              Lưu {picked.size} tình huống
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
              AI soạn tình huống nhập vai vừa sức cấp độ (vai của AI, mục tiêu, câu mở đầu, cụm từ gợi ý), tránh trùng tình huống đã có. Chỉ những tình huống bạn chọn
              mới được lưu.
            </Text>
          )}
          <Group grow align="flex-start">
            <Input.Wrapper label="Cấp độ">
              <SegmentedControl fullWidth data={PLACEMENT_LEVELS} value={level} onChange={(v) => setLevel(v as PlacementLevel)} />
            </Input.Wrapper>
            <Input.Wrapper label="Số tình huống">
              <SegmentedControl fullWidth data={COUNTS} value={count} onChange={setCount} />
            </Input.Wrapper>
          </Group>
          <TextInput
            label="Chủ đề (không bắt buộc)"
            placeholder="vd: du lịch, công việc văn phòng, sức khoẻ"
            value={topic}
            onChange={(e) => setTopic(e.currentTarget.value)}
          />
          <Textarea
            label="Mong muốn thêm (không bắt buộc)"
            placeholder="vd: tình huống ở Việt Nam với người nước ngoài"
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
