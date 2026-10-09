import { Alert, Badge, Button, Group, Paper, Progress, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconAlertTriangle, IconWaveSine } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { api, mediaSrc, type AdminListeningDetail, type ListeningLesson } from "../api";
import { notifyError } from "../lib";
import { AUDIO_STATE, formatDuration } from "./meta";

type Props = {
  lesson: ListeningLesson;
  detail: AdminListeningDetail | undefined;
  dirty: boolean;
  configured: boolean;
  onStarted: () => void;
};

/** Generates / plays the audio and shows the script the way the app highlights it. */
export function AudioPanel({ lesson, detail, dirty, configured, onStarted }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const [starting, setStarting] = useState(false);
  const audio = detail?.audio;
  const state = audio ? AUDIO_STATE[audio.state] : null;
  const timings = audio?.timings ?? null;
  const speakers = new Map(lesson.speakers.map((s) => [s.key, s.name || s.key]));
  const blocked = !detail
    ? "Tạo bài trước rồi mới tạo âm thanh."
    : !configured
      ? "Máy chủ chưa cấu hình Azure Speech."
      : dirty
        ? "Lưu thay đổi trước khi tạo âm thanh."
        : detail.problems.length
          ? "Sửa các lỗi của bài trước."
          : null;

  async function generate() {
    if (!detail) return;
    setStarting(true);
    try {
      await api.generateListeningAudio(detail.lesson.slug);
      onStarted();
    } catch (e) {
      notifyError(e);
    } finally {
      setStarting(false);
    }
  }

  function seek(i: number) {
    const el = audioRef.current;
    if (!el || !timings?.[i]) return;
    el.currentTime = timings[i][0] / 1000;
    void el.play();
  }

  const active = timings ? timings.findIndex(([s, e]) => now >= s && now < e + 450) : -1;

  return (
    <Stack gap="sm">
      <Paper p="md" radius="lg" shadow="xs">
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap={8} wrap="nowrap">
              <IconWaveSine size={20} />
              <Text fw={700}>Âm thanh</Text>
              {state ? (
                <Badge color={state.color} variant="light">
                  {state.label}
                </Badge>
              ) : null}
            </Group>
            {audio?.durationMs ? (
              <Text fz="sm" c="dimmed">
                {formatDuration(audio.durationMs)}
              </Text>
            ) : null}
          </Group>

          {audio?.state === "running" ? (
            <Stack gap={4}>
              <Progress value={(audio.done / Math.max(1, audio.total)) * 100} animated radius="xl" />
              <Text fz="xs" c="dimmed">
                Đã đọc {audio.done}/{audio.total} câu. Gói miễn phí cho 20 câu mỗi phút nên bài dài mất 1–2 phút; có thể rời trang.
              </Text>
            </Stack>
          ) : null}
          {audio?.state === "failed" ? (
            <Alert color="red" radius="md" icon={<IconAlertTriangle size={18} />}>
              {audio.error}
            </Alert>
          ) : null}
          {audio?.state === "stale" ? (
            <Alert color="orange" radius="md">
              Script hoặc giọng đọc đã đổi sau lần tạo trước. App đọc bằng giọng của điện thoại cho tới khi tạo lại.
            </Alert>
          ) : null}
          {audio?.state === "none" ? (
            <Text fz="sm" c="dimmed">
              Chưa có âm thanh: app đang đọc script bằng giọng của điện thoại.
            </Text>
          ) : null}

          {audio?.url ? (
            <audio ref={audioRef} controls preload="metadata" src={mediaSrc(audio.url)} style={{ width: "100%" }} onTimeUpdate={(e) => setNow(e.currentTarget.currentTime * 1000)} />
          ) : null}

          <Group justify="space-between" wrap="nowrap">
            <Text fz="xs" c="dimmed">
              {detail ? `Tốn khoảng ${(detail.chars + lesson.lines.length * 60).toLocaleString("vi-VN")} ký tự mỗi lần tạo` : ""}
            </Text>
            <Button
              size="sm"
              leftSection={<IconWaveSine size={16} />}
              disabled={!!blocked || audio?.state === "running"}
              loading={starting}
              onClick={generate}
              title={blocked ?? undefined}
            >
              {audio?.url ? "Tạo lại" : "Tạo âm thanh"}
            </Button>
          </Group>
          {blocked && detail ? (
            <Text fz="xs" c="orange.8" ta="right">
              {blocked}
            </Text>
          ) : null}
        </Stack>
      </Paper>

      <Paper radius={20} p="md" bg="white" shadow="xs">
        <Text fw={800} fz="lg">
          {lesson.titleEn || "(Tên tiếng Anh)"}
        </Text>
        <Text c="dimmed" fz="sm" mb="sm">
          {lesson.titleVi}
        </Text>
        <Stack gap={4}>
          {lesson.lines.map((l, i) => (
            <UnstyledButton
              key={i}
              onClick={() => seek(i)}
              p={8}
              style={{ borderRadius: 12, background: i === active ? "#E6F4F1" : undefined, cursor: timings ? "pointer" : "default" }}
            >
              {lesson.kind === "dialogue" || lesson.speakers.length > 1 ? (
                <Text fz={11} fw={700} c="teal.8" tt="uppercase">
                  {speakers.get(l.speaker) ?? l.speaker}
                </Text>
              ) : null}
              <Text fw={600} fz="sm">
                {l.en || "…"}
              </Text>
              <Text fz="xs" c="dimmed">
                {l.vi}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
