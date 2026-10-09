import { ActionIcon, Alert, Badge, Button, Group, Modal, Paper, SegmentedControl, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconClipboardText, IconPlayerPlay, IconPlus, IconRowInsertBottom, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { api, type ListeningLesson, type ListeningLine, type ListeningSpeaker, type ListeningVoice } from "../api";
import { Select } from "../components/AppSelect";
import { move } from "../grammar/meta";
import { notifyError } from "../lib";
import { DEFAULT_VOICES, nextSpeakerKey, parseScript } from "./meta";

const MAX_LINE = 400;

type Props = {
  lesson: ListeningLesson;
  voices: ListeningVoice[];
  canPreview: boolean;
  onChange: (patch: Partial<ListeningLesson>) => void;
};

export function SpeakersEditor({ lesson, voices, canPreview, onChange }: Props) {
  const [playing, setPlaying] = useState<string | null>(null);
  const speakers = lesson.speakers;
  const voiceOptions = voices.map((v) => ({ value: v.name, label: `${v.label} · ${v.accent}, ${v.gender}` }));
  const setSpeaker = (i: number, patch: Partial<ListeningSpeaker>) => onChange({ speakers: speakers.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function preview(s: ListeningSpeaker) {
    setPlaying(s.key);
    try {
      const sample = lesson.lines.find((l) => l.speaker === s.key && l.en.trim())?.en;
      const blob = await api.previewVoice(s.voice, sample, lesson.level);
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setPlaying(null);
      await audio.play();
    } catch (e) {
      notifyError(e);
      setPlaying(null);
    }
  }

  function remove(i: number) {
    const s = speakers[i];
    const used = lesson.lines.filter((l) => l.speaker === s.key).length;
    if (used && !window.confirm(`${s.name || s.key} đang đọc ${used} câu. Xoá người đọc này (các câu đó sẽ báo lỗi cho tới khi chọn người khác)?`)) return;
    onChange({ speakers: speakers.filter((_, j) => j !== i) });
  }

  return (
    <Paper p={{ base: "md", sm: "lg" }} radius="lg" shadow="xs">
      <Stack gap="sm">
        <Text fw={700}>Người đọc</Text>
        {speakers.map((s, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              label={i === 0 ? "Tên hiện trong app" : undefined}
              style={{ flex: 1, minWidth: 0 }}
              value={s.name}
              onChange={(e) => setSpeaker(i, { name: e.currentTarget.value })}
            />
            <Select
              label={i === 0 ? "Giọng" : undefined}
              style={{ flex: 1.3, minWidth: 0 }}
              data={voiceOptions}
              value={s.voice}
              onChange={(v) => v && setSpeaker(i, { voice: v })}
              allowDeselect={false}
            />
            <Tooltip label={canPreview ? "Nghe thử giọng" : "Cần cấu hình Azure Speech để nghe thử"}>
              <ActionIcon variant="light" size={36} disabled={!canPreview} loading={playing === s.key} onClick={() => preview(s)} aria-label="Nghe thử">
                <IconPlayerPlay size={18} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon variant="subtle" size={36} color="red" disabled={speakers.length <= 1} onClick={() => remove(i)} aria-label="Xoá người đọc">
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="light"
          size="sm"
          leftSection={<IconPlus size={16} />}
          style={{ alignSelf: "flex-start" }}
          disabled={speakers.length >= 4}
          onClick={() =>
            onChange({
              speakers: [...speakers, { key: nextSpeakerKey(speakers), name: "", voice: DEFAULT_VOICES[speakers.length % DEFAULT_VOICES.length] }],
            })
          }
        >
          Thêm người đọc
        </Button>
      </Stack>
    </Paper>
  );
}

export function LinesEditor({ lesson, onChange, problems }: Omit<Props, "voices" | "canPreview"> & { problems: Map<number, string[]> }) {
  const [pasting, setPasting] = useState(false);
  const lines = lesson.lines;
  const speakers = lesson.speakers;
  const setLine = (i: number, patch: Partial<ListeningLine>) => onChange({ lines: lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const insertAfter = (i: number) => {
    const prev = lines[i];
    // Dialogues usually alternate, so the new line goes to the next speaker.
    const idx = speakers.findIndex((s) => s.key === prev?.speaker);
    const speaker = speakers.length > 1 && idx >= 0 ? speakers[(idx + 1) % speakers.length].key : (speakers[0]?.key ?? "");
    onChange({ lines: [...lines.slice(0, i + 1), { speaker, en: "", vi: "" }, ...lines.slice(i + 1)] });
  };
  const speakerData = speakers.map((s) => ({ value: s.key, label: s.name || s.key }));

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={700}>
          Script · {lines.length} câu · {lines.reduce((n, l) => n + l.en.trim().length, 0).toLocaleString("vi-VN")} ký tự
        </Text>
        <Button variant="default" size="xs" leftSection={<IconClipboardText size={16} />} onClick={() => setPasting(true)}>
          Dán script
        </Button>
      </Group>
      {lines.map((line, i) => {
        const lineProblems = problems.get(i);
        return (
          <Paper key={i} p="sm" radius="lg" shadow="xs" withBorder={!!lineProblems} style={{ borderColor: lineProblems ? "#F08C00" : undefined }}>
            <Stack gap={6}>
              <Group gap="xs" wrap="nowrap">
                <Text fw={800} c="dimmed" w={24} ta="center" fz="sm">
                  {i + 1}
                </Text>
                {speakers.length <= 3 ? (
                  <SegmentedControl size="xs" data={speakerData} value={line.speaker} onChange={(speaker) => setLine(i, { speaker })} />
                ) : (
                  <Select size="xs" w={160} data={speakerData} value={line.speaker} onChange={(v) => v && setLine(i, { speaker: v })} allowDeselect={false} />
                )}
                <Group gap={2} ml="auto" wrap="nowrap">
                  <ActionIcon variant="subtle" size="sm" disabled={i === 0} onClick={() => onChange({ lines: move(lines, i, -1) })} aria-label="Lên">
                    <IconArrowUp size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" size="sm" disabled={i === lines.length - 1} onClick={() => onChange({ lines: move(lines, i, 1) })} aria-label="Xuống">
                    <IconArrowDown size={16} />
                  </ActionIcon>
                  <Tooltip label="Thêm câu bên dưới">
                    <ActionIcon variant="subtle" size="sm" onClick={() => insertAfter(i)} aria-label="Thêm câu bên dưới">
                      <IconRowInsertBottom size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color="red"
                    onClick={() => (!line.en.trim() || window.confirm(`Xoá câu ${i + 1}?`)) && onChange({ lines: lines.filter((_, j) => j !== i) })}
                    aria-label="Xoá câu"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
              <Textarea
                autosize
                minRows={1}
                placeholder="Câu tiếng Anh (được đọc thành tiếng)"
                value={line.en}
                error={line.en.length > MAX_LINE ? `Dài ${line.en.length}/${MAX_LINE} ký tự, nên tách ra.` : undefined}
                onChange={(e) => setLine(i, { en: e.currentTarget.value })}
                styles={{ input: { fontWeight: 600 } }}
              />
              <Textarea autosize minRows={1} placeholder="Bản dịch tiếng Việt" value={line.vi} onChange={(e) => setLine(i, { vi: e.currentTarget.value })} />
              {lineProblems ? (
                <Text fz="xs" c="orange.8">
                  {lineProblems.join(" ")}
                </Text>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
      <Button variant="light" leftSection={<IconPlus size={18} />} style={{ alignSelf: "flex-start" }} onClick={() => insertAfter(lines.length - 1)}>
        Thêm câu
      </Button>
      <PasteModal opened={pasting} onClose={() => setPasting(false)} lesson={lesson} onChange={onChange} />
    </Stack>
  );
}

function PasteModal({ opened, onClose, lesson, onChange }: { opened: boolean; onClose: () => void } & Omit<Props, "voices" | "canPreview">) {
  const [text, setText] = useState("");
  const parsed = text.trim() ? parseScript(text, lesson.speakers) : null;
  const added = parsed ? parsed.speakers.length - lesson.speakers.length : 0;

  function apply(mode: "replace" | "append") {
    if (!parsed) return;
    const base = mode === "replace" ? [] : lesson.lines.filter((l) => l.en.trim() || l.vi.trim());
    onChange({ speakers: parsed.speakers, lines: [...base, ...parsed.lines] });
    setText("");
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Dán script" size="lg">
      <Stack>
        <Text fz="sm" c="dimmed">
          Mỗi dòng một câu. Ghi <b>Tên: câu</b> để chọn người đọc (tên mới sẽ thành người đọc mới), thêm <b>| bản dịch</b> nếu có.
        </Text>
        <Textarea
          autosize
          minRows={8}
          maxRows={18}
          placeholder={"Anna: Hi! Are you new here? | Chào bạn! Bạn mới đến à?\nBen: Yes, I moved in yesterday. | Ừ, mình mới chuyển đến hôm qua."}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        {parsed ? (
          <Alert color="blue" radius="md">
            {parsed.lines.length} câu
            {added > 0 ? (
              <>
                {" "}
                · thêm người đọc:{" "}
                {parsed.speakers.slice(lesson.speakers.length).map((s) => (
                  <Badge key={s.key} variant="light" mr={4}>
                    {s.name}
                  </Badge>
                ))}
              </>
            ) : null}
            {parsed.lines.some((l) => !l.vi) ? " · một số câu chưa có bản dịch" : ""}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" disabled={!parsed} onClick={() => apply("append")}>
            Thêm vào cuối
          </Button>
          <Button disabled={!parsed} onClick={() => apply("replace")}>
            Thay toàn bộ script
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
