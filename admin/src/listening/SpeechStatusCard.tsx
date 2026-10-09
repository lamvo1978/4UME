import { Alert, Group, Paper, Progress, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

/** Whether the server can generate audio, and how much of the monthly free quota is used. */
export function SpeechStatusCard({ needAudio }: { needAudio?: number }) {
  const status = useQuery({ queryKey: ["speech-status"], queryFn: api.speechStatus, staleTime: 30_000 });
  const s = status.data;
  if (!s) return null;

  if (!s.configured) {
    return (
      <Alert color="yellow" radius="lg" icon={<IconInfoCircle size={18} />} title="Chưa bật giọng đọc Azure">
        Máy chủ chưa có <b>AZURE_SPEECH_KEY</b> / <b>AZURE_SPEECH_REGION</b> nên chưa tạo được âm thanh. Trong lúc đó app đọc script bằng
        giọng có sẵn của điện thoại. Cách đăng ký gói miễn phí: xem <b>docs/listening.md</b>.
      </Alert>
    );
  }

  const pct = Math.min(100, (s.charsUsed / s.monthlyCharLimit) * 100);
  return (
    <Paper p="sm" radius="lg" shadow="xs">
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Text fz="sm" fw={600}>
          Azure Speech ({s.region}) · tháng {s.month.slice(5)}/{s.month.slice(0, 4)}
        </Text>
        <Text fz="sm" c="dimmed">
          ~{s.charsUsed.toLocaleString("vi-VN")} / {s.monthlyCharLimit.toLocaleString("vi-VN")} ký tự
        </Text>
      </Group>
      <Progress value={pct} color={pct > 85 ? "red" : pct > 60 ? "orange" : "teal"} radius="xl" />
      {needAudio ? (
        <Text fz="xs" c="orange.8" mt={6}>
          {needAudio} bài đang hiện chưa có âm thanh hoặc cần tạo lại.
        </Text>
      ) : null}
    </Paper>
  );
}
