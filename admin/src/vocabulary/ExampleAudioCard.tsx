import { Button, Group, NumberInput, Paper, Progress, Stack, Text } from "@mantine/core";
import { IconMicrophone } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { notifyError } from "../lib";

const KEY = ["word-example-audio"];

export function ExampleAudioCard() {
  const queryClient = useQueryClient();
  const audio = useQuery({
    queryKey: KEY,
    queryFn: api.wordExampleAudio,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  });
  const [starting, setStarting] = useState(false);
  const [maxPercent, setMaxPercent] = useState<number | string>(85);

  const a = audio.data;
  const running = a?.running ?? false;

  async function start() {
    setStarting(true);
    try {
      const pct = typeof maxPercent === "number" ? maxPercent : Number(maxPercent);
      const body =
        maxPercent === "" || maxPercent === undefined || !Number.isFinite(pct) || pct <= 0 || pct > 100
          ? undefined
          : { maxMonthPercent: pct };
      queryClient.setQueryData(KEY, await api.startWordExampleAudio(body));
    } catch (e) {
      notifyError(e);
    } finally {
      setStarting(false);
    }
  }

  if (!a) return null;

  return (
    <Paper p="sm" radius="lg" shadow="xs">
      {running ? (
        <Stack gap={6}>
          <Text fz="sm">
            Đang tạo giọng đọc câu ví dụ… {a.done}/{a.total} từ
          </Text>
          <Progress value={a.total ? (a.done / a.total) * 100 : 0} animated />
        </Stack>
      ) : (
        <Stack gap="sm">
          <div>
            <Text fz="sm" fw={600}>
              Giọng đọc câu ví dụ (Azure)
            </Text>
            <Text fz="sm" mt={4}>
              {a.missing ? (
                <>
                  <b>{a.missing}</b> câu ví dụ chưa có recording (app tạm đọc bằng giọng điện thoại).
                </>
              ) : (
                "Mọi câu ví dụ đang hiện đều đã có giọng Azure."
              )}
            </Text>
            <Text fz="xs" c="dimmed" mt={4}>
              Xen kẽ giọng nữ / nam theo thứ tự từ trong catalog. Azure tháng này: {a.monthChars.toLocaleString("vi-VN")}/
              {a.monthCharLimit.toLocaleString("vi-VN")} ký tự (dùng chung với bài nghe, luyện câu…)
              {a.configured ? "" : " · máy chủ chưa cấu hình Azure Speech"}
            </Text>
            {a.error ? (
              <Text fz="xs" c="red.7" mt={4}>
                Lần trước lỗi: {a.error}
              </Text>
            ) : null}
          </div>
          <Stack gap={6}>
            <div>
              <Text fz="sm" fw={500}>
                Giới hạn quota tháng (%)
              </Text>
              <Text fz="xs" c="dimmed" mt={2} maw="100%">
                Chỉ dùng tối đa bấy nhiêu % F0 tháng này trừ phần đã tiêu. Để trống = hết phần còn lại.
              </Text>
            </div>
            <Group justify="space-between" wrap="wrap" align="flex-end">
              <NumberInput
                aria-label="Giới hạn quota tháng (%)"
                value={maxPercent}
                onChange={setMaxPercent}
                min={1}
                max={100}
                w={220}
                disabled={!a.configured || a.missing === 0}
              />
              <Button
                variant="light"
                leftSection={<IconMicrophone size={18} />}
                onClick={start}
                loading={starting}
                disabled={!a.configured || a.missing === 0}
              >
                Tạo giọng đọc
              </Button>
            </Group>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}
