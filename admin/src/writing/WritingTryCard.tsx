import { Alert, Badge, Button, Divider, Group, Mark, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { Fragment, type ReactNode, useState } from "react";
import { api, type AiProvider, type PlacementLevel, type WritingResult, type WritingTry } from "../api";
import { PLACEMENT_LEVELS } from "../placement/meta";

const SAMPLE =
  "Last weekend I go to Vung Tau with my family. We stay in a small hotel near the beach. The weather is very hot but we enjoyed. " +
  "In the evening we eat seafood and walk along the beach. I very like this trip because I can relax after a busy week.";

/** Grades a pasted paragraph with a chosen provider / model, without saving or counting it, to compare AI models. */
export function WritingTryCard({ providers }: { providers: AiProvider[] | undefined }) {
  const [level, setLevel] = useState<PlacementLevel>("A2");
  const [text, setText] = useState(SAMPLE);
  const [promptEn, setPromptEn] = useState("Write about what you did last weekend.");
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<(WritingTry & { text: string; label: string })[]>([]);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const r = await api.tryWriting({
        level,
        text,
        promptEn: promptEn.trim() || undefined,
        provider: provider ?? undefined,
        model: provider && model.trim() ? model.trim() : undefined,
      });
      setRuns((x) => [{ ...r, text, label: provider ? providers?.find((p) => p.key === provider)?.name ?? provider : "Theo thứ tự" }, ...x].slice(0, 4));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Stack gap="sm">
        <div>
          <Text fw={600}>Chấm thử</Text>
          <Text fz="xs" c="dimmed">
            Dán một bài mẫu, chọn AI rồi bấm chấm để so chất lượng và tốc độ giữa các model. Không lưu, không tính lượt của ai.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select label="Cấp độ" data={PLACEMENT_LEVELS} value={level} allowDeselect={false} onChange={(v) => setLevel(v as PlacementLevel)} />
          <Select
            label="AI"
            placeholder="Theo thứ tự đã cài"
            clearable
            data={(providers ?? []).map((p) => ({ value: p.key, label: p.configured ? p.name : `${p.name} (chưa có key)`, disabled: !p.configured }))}
            value={provider}
            onChange={setProvider}
          />
          <TextInput
            label="Model (không bắt buộc)"
            placeholder={provider ? providers?.find((p) => p.key === provider)?.model.split(",")[0] : "Chọn AI trước"}
            disabled={!provider}
            value={model}
            onChange={(e) => setModel(e.currentTarget.value)}
          />
        </SimpleGrid>
        <TextInput label="Đề bài (không bắt buộc)" value={promptEn} onChange={(e) => setPromptEn(e.currentTarget.value)} />
        <Textarea label="Bài viết" autosize minRows={4} maxRows={12} value={text} onChange={(e) => setText(e.currentTarget.value)} />
        {error ? <Alert color="red">{error}</Alert> : null}
        <Group justify="flex-end">
          <Button leftSection={<IconPlayerPlay size={16} />} loading={busy} onClick={run} disabled={!text.trim()}>
            Chấm
          </Button>
        </Group>
        {runs.map((r, i) => (
          <Fragment key={i}>
            <Divider label={`${r.label} · ${r.model} · ${(r.milliseconds / 1000).toFixed(1)} giây`} labelPosition="left" />
            <ResultView text={r.text} result={r.result} />
          </Fragment>
        ))}
      </Stack>
    </Paper>
  );
}

function ResultView({ text, result }: { text: string; result: WritingResult }) {
  const s = result.scores;
  return (
    <Stack gap={6}>
      <Group gap="xs">
        <Badge size="lg" color={result.score >= 70 ? "teal" : result.score >= 50 ? "yellow" : "red"}>
          {result.score}
        </Badge>
        <Text fz="xs" c="dimmed">
          Ngữ pháp {s.grammar} · Từ vựng {s.vocabulary} · Mạch lạc {s.coherence} · Đúng đề {s.task}
        </Text>
      </Group>
      <Text fz="sm">{result.feedbackVi}</Text>
      <Text fz="sm" style={{ whiteSpace: "pre-wrap" }}>
        <Highlighted text={text} result={result} />
      </Text>
      {result.corrections.map((c, i) => (
        <Text key={i} fz="xs">
          <Badge size="xs" variant="light" tt="none" mr={4}>
            {c.kind}
          </Badge>
          <s>{c.original}</s> → <b>{c.corrected}</b> · {c.explainVi}
          {c.start < 0 ? <Text span c="orange.8"> (AI trích sai, không tô được)</Text> : null}
        </Text>
      ))}
      {result.rewrite ? (
        <Text fz="sm" c="dimmed" fs="italic" style={{ whiteSpace: "pre-wrap" }}>
          {result.rewrite}
        </Text>
      ) : null}
      {result.upgrades.map((u, i) => (
        <Text key={i} fz="xs">
          ⬆ <b>{u.en}</b> · {u.vi} · {u.whyVi}
        </Text>
      ))}
    </Stack>
  );
}

/** The learner's text with each located mistake marked. */
function Highlighted({ text, result }: { text: string; result: WritingResult }) {
  const spans = result.corrections.filter((c) => c.start >= 0).sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let at = 0;
  spans.forEach((c, i) => {
    if (c.start < at) return;
    parts.push(<Fragment key={`t${i}`}>{text.slice(at, c.start)}</Fragment>);
    parts.push(
      <Mark key={`m${i}`} color="red.1" title={`${c.corrected} · ${c.explainVi}`}>
        {text.slice(c.start, c.start + c.original.length)}
      </Mark>
    );
    at = c.start + c.original.length;
  });
  parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}
