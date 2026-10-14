import { Alert, Badge, Button, Checkbox, Group, Input, Modal, Paper, SegmentedControl, Select, Stack, Text, Textarea } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type AdminGrammarSummary, type PlacementGrammarDraft, type PlacementGrammarInput, type PlacementLevel } from "../api";
import { SkipCheckSwitch, useSkipCheck } from "../grammar/SkipCheckSwitch";
import { AiProviderSelect, useAiProvider } from "../components/AiProviderSelect";
import { PLACEMENT_LEVELS } from "./meta";

const COUNTS = ["1", "5", "10", "15", "20"];

type Props = {
  opened: boolean;
  onClose: () => void;
  level: PlacementLevel;
  lessons: AdminGrammarSummary[];
  onAdd: (questions: PlacementGrammarInput[]) => Promise<void>;
};

/** The AI drafts placement questions from the level's grammar lessons; the admin ticks the ones to save. */
export function PlacementDraftModal({ opened, onClose, level: initialLevel, lessons, onAdd }: Props) {
  const status = useQuery({ queryKey: ["listening-draft-status"], queryFn: api.listeningDraftStatus, enabled: opened, staleTime: 60_000 });
  const [level, setLevel] = useState<PlacementLevel>(initialLevel);
  const [count, setCount] = useState("10");
  const [lessonSlug, setLessonSlug] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<PlacementGrammarDraft | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [skipCheck, setSkipCheck] = useSkipCheck();
  const [provider, setProvider] = useAiProvider(status.data?.providers);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setLevel(initialLevel);
    setLessonSlug(null);
    setDraft(null);
    setError("");
  }, [opened, initialLevel]);

  const levelLessons = lessons.filter((l) => l.level === level);
  const titleOf = (slug: string | null) => lessons.find((l) => l.slug === slug)?.titleVi;

  async function write() {
    setBusy(true);
    setError("");
    try {
      const result = await api.draftPlacementGrammar({ level, count: Number(count), lessonSlug: lessonSlug ?? undefined, notes: notes.trim() || undefined, skipCheck, provider: provider || undefined });
      setSkipped(skipCheck);
      setDraft(result);
      setPicked(new Set(result.items.flatMap((item, i) => (item.problems.length === 0 && !item.warning ? [i] : []))));
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
      await onAdd(draft.items.filter((_, i) => picked.has(i)).map((item) => item.question));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const notConfigured = status.data && !status.data.configured;
  const doubtful = draft?.items.filter((i) => i.warning || i.problems.length > 0).length ?? 0;

  return (
    <Modal opened={opened} onClose={busy || saving ? () => {} : onClose} title={`AI soạn câu kiểm tra ngữ pháp ${level}`} size="xl" radius="lg">
      {draft ? (
        <Stack>
          <Text fz="xs" c="dimmed">
            Soạn bởi {draft.model}
          </Text>
          {!draft.checked ? (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              {skipped
                ? "Đã bỏ bước AI tự kiểm tra. Hãy đọc kỹ đáp án từng câu trước khi lưu."
                : "Chưa tự kiểm tra lại được đáp án (AI đang giới hạn lượt gọi). Hãy đọc kỹ từng câu trước khi lưu."}
            </Alert>
          ) : doubtful > 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
              {doubtful} câu bị AI nghi có vấn đề nên chưa được chọn. Nếu vẫn muốn giữ, chọn rồi sửa lại sau khi lưu.
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              AI đã tự kiểm tra lại đáp án, không thấy câu nào có vấn đề. Bạn vẫn nên đọc lướt trước khi lưu.
            </Text>
          )}
          <Stack gap="xs">
            {draft.items.map(({ question: q, problems, warning }, i) => {
              const on = picked.has(i);
              return (
                <Paper key={i} withBorder radius="md" p="sm" style={{ borderColor: warning || problems.length ? "#F08C00" : undefined }}>
                  <Group align="flex-start" wrap="nowrap" gap="sm">
                    <Checkbox
                      mt={2}
                      checked={on}
                      onChange={() =>
                        setPicked((s) => {
                          const next = new Set(s);
                          if (on) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                      aria-label={`Chọn câu ${i + 1}`}
                    />
                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      {q.lessonSlug ? (
                        <Badge variant="light" size="sm" w="fit-content">
                          {titleOf(q.lessonSlug) ?? q.lessonSlug}
                        </Badge>
                      ) : null}
                      <Text fz="sm" fw={600}>
                        {q.prompt}
                      </Text>
                      <Group gap={6}>
                        {q.options.map((o) => (
                          <Badge key={o} variant={o === q.answer ? "filled" : "outline"} color={o === q.answer ? "teal" : "gray"} tt="none">
                            {o}
                          </Badge>
                        ))}
                      </Group>
                      {q.explanationVi ? (
                        <Text fz="xs" c="dimmed">
                          {q.explanationVi}
                        </Text>
                      ) : null}
                      {warning ? (
                        <Text fz="xs" c="orange.8">
                          AI kiểm tra: {warning}
                        </Text>
                      ) : null}
                      {problems.length ? (
                        <Text fz="xs" c="red.7">
                          Thiếu / sai khuôn: {problems.join(" ")}
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
              AI dựa vào danh sách bài ngữ pháp của cấp độ để soạn câu trắc nghiệm, mỗi câu gắn với một bài, rồi tự kiểm tra lại đáp án. Chỉ những câu bạn
              chọn mới được lưu.
            </Text>
          )}
          <Group grow align="flex-start">
            <Input.Wrapper label="Cấp độ">
              <SegmentedControl
                fullWidth
                data={PLACEMENT_LEVELS}
                value={level}
                onChange={(v) => {
                  setLevel(v as PlacementLevel);
                  setLessonSlug(null);
                }}
              />
            </Input.Wrapper>
            <Input.Wrapper label="Số câu">
              <SegmentedControl fullWidth data={COUNTS} value={count} onChange={setCount} />
            </Input.Wrapper>
          </Group>
          <Select
            label="Chỉ soạn cho bài"
            description="Để trống: AI chia câu cho nhiều bài của cấp độ"
            placeholder={levelLessons.length ? "Tất cả bài của cấp độ" : `Chưa có bài ngữ pháp ${level}`}
            clearable
            searchable
            data={levelLessons.map((l) => ({ value: l.slug, label: l.titleVi }))}
            value={lessonSlug}
            onChange={setLessonSlug}
          />
          <Textarea
            label="Mong muốn thêm (không bắt buộc)"
            placeholder="vd: ưu tiên các thì; tránh câu quá dài"
            autosize
            minRows={2}
            maxRows={5}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <AiProviderSelect providers={status.data?.providers} value={provider} onChange={setProvider} />
          <SkipCheckSwitch value={skipCheck} onChange={setSkipCheck} />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Huỷ
            </Button>
            <Button leftSection={<IconSparkles size={18} />} onClick={write} loading={busy} disabled={notConfigured || levelLessons.length === 0}>
              Soạn bằng AI
            </Button>
          </Group>
          {busy ? (
            <Text size="xs" c="dimmed" ta="right">
              {skipCheck ? "Soạn thường mất 10–40 giây…" : "Soạn và tự kiểm tra thường mất 20–60 giây…"}
            </Text>
          ) : null}
        </Stack>
      )}
    </Modal>
  );
}
