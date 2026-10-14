import { Alert, Button, Group, Progress, Stack, Text } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { notifyError, notifySaved } from "../lib";

const KEY = ["grammar-verbs"];

/** Tense labels the app shows when a learner taps a verb; questions without them are tagged here in one go. */
export function VerbTaggingCard() {
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const status = useQuery({
    queryKey: KEY,
    queryFn: api.grammarVerbs,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  });
  const s = status.data;

  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && s && !s.running && !s.error) notifySaved("Đã gắn thì động từ xong");
    wasRunning.current = !!s?.running;
  }, [s]);

  if (!s || (!s.running && !s.error && s.missing === 0)) return null;

  async function start() {
    setStarting(true);
    try {
      queryClient.setQueryData(KEY, await api.startGrammarVerbs());
    } catch (e) {
      notifyError(e);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Alert color="grape" variant="light" radius="lg" icon={<IconSparkles size={20} />} title="Thì động từ khi tra từ">
      <Stack gap="xs">
        <Text fz="sm">
          Trong app, học viên chạm vào một động từ sẽ thấy nó đang chia ở thì nào. Câu mới do AI soạn được gắn sẵn; câu nhập tay hoặc vừa sửa
          thì cần gắn lại.
        </Text>
        {s.running ? (
          <>
            <Text fz="sm" fw={600}>
              Đang gắn… {s.done}/{s.total} bài
            </Text>
            <Progress value={s.total ? (s.done / s.total) * 100 : 0} animated />
          </>
        ) : (
          <Group justify="space-between" gap="sm">
            <Text fz="sm" fw={600}>
              {s.missing} câu chưa có thì động từ
            </Text>
            <Button size="xs" color="grape" leftSection={<IconSparkles size={14} />} loading={starting} disabled={!s.configured} onClick={start}>
              Gắn thì động từ (AI)
            </Button>
          </Group>
        )}
        {s.error ? (
          <Text fz="sm" c="red">
            {s.error}
          </Text>
        ) : null}
      </Stack>
    </Alert>
  );
}
