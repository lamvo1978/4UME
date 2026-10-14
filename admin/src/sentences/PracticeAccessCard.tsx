import { Button, Group, NumberInput, Paper, Stack, Switch, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type PracticeConfig } from "../api";
import { notifyError, notifySaved } from "../lib";

const KEY = ["practice-config"];

/** Who may use the Luyện tab: Premium always, free learners on streak gift days and one try. */
export function PracticeAccessCard() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: KEY, queryFn: api.practiceConfig });
  const [draft, setDraft] = useState<PracticeConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config.data) setDraft(config.data);
  }, [config.data]);

  if (!draft || !config.data) return null;
  const changed = draft.giftEveryDays !== config.data.giftEveryDays || draft.freeTrial !== config.data.freeTrial;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      queryClient.setQueryData(KEY, await api.savePracticeConfig(draft));
      notifySaved("Đã lưu quyền dùng");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper p="sm" radius="lg" shadow="xs">
      <Stack gap="xs">
        <Text fw={600}>Ai được luyện</Text>
        <Text fz="sm" c="dimmed">
          Premium luyện không giới hạn. Người dùng miễn phí được mở cả ngày hôm sau khi giữ chuỗi đủ số ngày bên dưới (7, 14, 21… ngày), tới 23:59 —
          không tích luỹ.
        </Text>
        <Group align="flex-end" gap="lg">
          <NumberInput
            label="Giữ chuỗi bao nhiêu ngày thì tặng 1 ngày"
            description="0 = tắt quà giữ chuỗi"
            min={0}
            max={60}
            w={300}
            value={draft.giftEveryDays}
            onChange={(v) => setDraft({ ...draft, giftEveryDays: typeof v === "number" ? v : 0 })}
          />
          <Switch
            label="Cho thử 1 lượt (10 câu) một lần duy nhất"
            checked={draft.freeTrial}
            onChange={(e) => setDraft({ ...draft, freeTrial: e.currentTarget.checked })}
            mb={8}
          />
          <Button ml="auto" disabled={!changed} loading={saving} onClick={save}>
            Lưu
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
