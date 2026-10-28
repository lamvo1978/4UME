import { Alert, Badge, Button, Checkbox, Chip, Group, Input, Modal, Paper, SegmentedControl, Stack, Text, Textarea } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type GrammarBank, type GrammarDraft, type GrammarDraftDifficulty, type GrammarExercise, type GrammarLesson } from "../api";
import { BANKS, cleanLesson, displayAnswer, exerciseMeta, typesFor } from "./meta";
import { SkipCheckSwitch, useSkipCheck } from "./SkipCheckSwitch";
import { AiProviderSelect, useAiProvider } from "../components/AiProviderSelect";

const COUNTS = ["1", "5", "10", "15", "20"];
const DIFFICULTIES: { value: GrammarDraftDifficulty; label: string }[] = [
  { value: "easy", label: "Dễ" },
  { value: "mixed", label: "Trộn" },
  { value: "hard", label: "Khó" },
];

type Props = {
  opened: boolean;
  onClose: () => void;
  lesson: GrammarLesson;
  bank: GrammarBank;
  onAdd: (bank: GrammarBank, exercises: GrammarExercise[]) => void;
};

/** The AI drafts questions for the lesson being edited; the admin ticks the ones to add. Nothing is saved until the lesson is saved. */
export function GrammarDraftModal({ opened, onClose, lesson, bank: initialBank, onAdd }: Props) {
  const status = useQuery({ queryKey: ["listening-draft-status"], queryFn: api.listeningDraftStatus, enabled: opened, staleTime: 60_000 });
  const [bank, setBank] = useState<GrammarBank>(initialBank);
  const [count, setCount] = useState("10");
  const [types, setTypes] = useState<string[]>(typesFor(initialBank).map((t) => t.type));
  const [difficulty, setDifficulty] = useState<GrammarDraftDifficulty>("mixed");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<GrammarDraft | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [skipCheck, setSkipCheck] = useSkipCheck();
  const [provider, setProvider] = useAiProvider(status.data?.providers);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setBank(initialBank);
    setTypes(typesFor(initialBank).map((t) => t.type));
    setDraft(null);
    setError("");
  }, [opened, initialBank]);

  const switchBank = (next: GrammarBank) => {
    setBank(next);
    setTypes(typesFor(next).map((t) => t.type));
  };

  async function write() {
    setBusy(true);
    setError("");
    try {
      const result = await api.draftGrammar({
        lesson: cleanLesson(lesson),
        target: bank,
        count: Number(count),
        types,
        difficulty,
        notes: notes.trim() || undefined,
        skipCheck,
        provider: provider || undefined,
      });
      setSkipped(skipCheck);
      setDraft(result);
      setPicked(new Set(result.items.filter((i) => i.problems.length === 0 && !i.warning).map((i) => i.exercise.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!draft) return;
    onAdd(bank, draft.items.filter((i) => picked.has(i.exercise.id)).map((i) => i.exercise));
    onClose();
  }

  const notConfigured = status.data && !status.data.configured;
  const doubtful = draft?.items.filter((i) => i.warning || i.problems.length > 0).length ?? 0;
  const bankLabel = BANKS.find((b) => b.value === bank)!.label;

  return (
    <Modal opened={opened} onClose={busy ? () => {} : onClose} title="AI soạn bài tập" size="xl" radius="lg">
      {draft ? (
        <Stack>
          <Text fz="xs" c="dimmed">
            Soạn bởi {draft.model}
          </Text>
          {!draft.checked ? (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              {skipped
                ? "Đã bỏ bước AI tự kiểm tra. Hãy đọc kỹ đáp án từng câu trước khi thêm."
                : "Chưa tự kiểm tra lại được đáp án (AI đang giới hạn lượt gọi). Hãy đọc kỹ từng câu trước khi thêm."}
            </Alert>
          ) : doubtful > 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
              {doubtful} câu bị AI tự kiểm tra nghi có vấn đề nên chưa được chọn. Đọc ghi chú màu cam, sửa sau khi thêm nếu vẫn muốn giữ.
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              AI đã tự kiểm tra lại đáp án, không thấy câu nào có vấn đề. Bạn vẫn nên đọc lướt trước khi thêm.
            </Text>
          )}
          <Stack gap="xs">
            {draft.items.map(({ exercise: ex, problems, warning }) => {
              const meta = exerciseMeta(ex.type);
              const on = picked.has(ex.id);
              return (
                <Paper key={ex.id} withBorder radius="md" p="sm" style={{ borderColor: warning || problems.length ? "#F08C00" : undefined }}>
                  <Group align="flex-start" wrap="nowrap" gap="sm">
                    <Checkbox
                      mt={2}
                      checked={on}
                      onChange={() =>
                        setPicked((s) => {
                          const next = new Set(s);
                          if (on) next.delete(ex.id);
                          else next.add(ex.id);
                          return next;
                        })
                      }
                      aria-label={`Chọn ${ex.id}`}
                    />
                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={6}>
                        <Badge variant="light" color={meta.color} size="sm">
                          {meta.label}
                        </Badge>
                        <Text fz="xs" c="dimmed">
                          {ex.id}
                        </Text>
                      </Group>
                      <Text fz="sm" fw={600} style={{ whiteSpace: "pre-wrap" }}>
                        {ex.type === "transform" ? `${ex.instructionVi}: ${ex.source}` : ex.prompt || ex.promptVi || ex.sentence}
                      </Text>
                      {ex.type === "mcq" ? (
                        <Text fz="xs" c="dimmed">
                          Lựa chọn: {ex.options?.join(" · ")}
                          {(ex.acceptedAnswers?.length ?? 0) > 0 ? ` · cũng đúng: ${ex.acceptedAnswers!.join(", ")}` : ""}
                        </Text>
                      ) : null}
                      <Text fz="sm" c="teal.8">
                        → {displayAnswer(ex)}
                        {ex.type === "fill" && (ex.answers?.length ?? 0) > 1 ? ` (chấp nhận: ${ex.answers!.join(", ")})` : ""}
                      </Text>
                      <Text fz="xs" c="dimmed">
                        {ex.explanationVi}
                      </Text>
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
          <Group justify="space-between">
            <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => setDraft(null)}>
              Soạn lại
            </Button>
            <Button onClick={add} disabled={picked.size === 0}>
              Thêm {picked.size} câu vào "{bankLabel}"
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
              AI đọc phần lý thuyết và các câu đã có của bài để soạn câu mới không trùng, rồi tự kiểm tra lại đáp án. Câu chỉ được thêm vào bài khi bạn chọn, và
              chỉ được lưu khi bấm <b>Lưu thay đổi</b>.
            </Text>
          )}
          <Input.Wrapper label="Thêm vào" description={BANKS.find((b) => b.value === bank)!.hint}>
            <SegmentedControl fullWidth data={BANKS.map((b) => ({ value: b.value, label: b.label }))} value={bank} onChange={(v) => switchBank(v as GrammarBank)} />
          </Input.Wrapper>
          <Group grow align="flex-start">
            <Input.Wrapper label="Số câu">
              <SegmentedControl fullWidth data={COUNTS} value={count} onChange={setCount} />
            </Input.Wrapper>
            <Input.Wrapper label="Độ khó">
              <SegmentedControl fullWidth data={DIFFICULTIES} value={difficulty} onChange={(v) => setDifficulty(v as GrammarDraftDifficulty)} />
            </Input.Wrapper>
          </Group>
          <Input.Wrapper label="Dạng bài" description="AI chia đều số câu cho các dạng được chọn.">
            <Chip.Group multiple value={types} onChange={setTypes}>
              <Group gap={6} mt={6}>
                {typesFor(bank).map((t) => (
                  <Chip key={t.type} value={t.type} size="sm" variant="light">
                    {t.label}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </Input.Wrapper>
          <Textarea
            label="Mong muốn thêm (không bắt buộc)"
            placeholder="vd: tập trung câu hỏi Yes/No; chủ đề công việc văn phòng; nhiều câu phân biệt với hiện tại tiếp diễn"
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
            <Button leftSection={<IconSparkles size={18} />} onClick={write} loading={busy} disabled={notConfigured || types.length === 0}>
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
