import { Alert, Button, Divider, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type ConversationConfig } from "../api";
import { notifyError, notifySaved } from "../lib";

export const CONVERSATION_CONFIG_KEY = ["conversation-config"];

const num = (v: string | number) => (typeof v === "number" ? v : 0);
const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Turns per day, the Premium Azure voice switch and its monthly character caps (F0 first, then S0). */
export function ConversationConfigCard() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: CONVERSATION_CONFIG_KEY, queryFn: api.conversationConfig });
  const [draft, setDraft] = useState<ConversationConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config.data) setDraft({ ...config.data.defaults, ...config.data.value });
  }, [config.data]);

  if (config.error) return <Alert color="red">{(config.error as Error).message}</Alert>;
  if (!draft || !config.data) return null;
  const d = config.data;
  const u = d.usage;
  const changed = JSON.stringify(draft) !== JSON.stringify(d.value);
  const set = (patch: Partial<ConversationConfig>) => setDraft({ ...draft, ...patch });
  const aiReady = d.providers.some((p) => p.configured);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      queryClient.setQueryData(CONVERSATION_CONFIG_KEY, await api.saveConversationConfig(draft));
      notifySaved("Đã lưu cài đặt đàm thoại");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm("Đưa cài đặt đàm thoại về mặc định?")) return;
    setSaving(true);
    try {
      queryClient.setQueryData(CONVERSATION_CONFIG_KEY, await api.resetConversationConfig());
      notifySaved("Đã về mặc định");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>Cài đặt</Text>
          <Switch label="Bật đàm thoại trong app" checked={draft.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
        </Group>
        {!aiReady ? (
          <Alert color="yellow">
            Máy chủ chưa có <b>GROQ_API_KEY</b> hoặc <b>GEMINI_API_KEY</b>, app sẽ báo tính năng đang tạm dừng.
          </Alert>
        ) : (
          <Text fz="xs" c="dimmed">
            AI trả lời: {d.providers.filter((p) => p.configured).map((p) => `${p.name} (${p.model})`).join(" → ")}
          </Text>
        )}

        <Text fz="xs" c="dimmed">
          Hai ô «cũ» chỉ giữ cho cấu hình đã lưu trước đây. App không dùng chúng cho quota hay màn Premium — số trên màn đó lấy từ buổi/lượt phía dưới.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumberInput label="Lượt nói mỗi ngày · miễn phí (cũ, không dùng)" min={0} max={1000} value={draft.freeDailyTurns} onChange={(v) => set({ freeDailyTurns: num(v) })} />
          <NumberInput label="Lượt nói mỗi ngày · Premium (cũ, không dùng)" min={0} max={1000} value={draft.premiumDailyTurns} onChange={(v) => set({ premiumDailyTurns: num(v) })} />
          <NumberInput label="Trần kỹ thuật mỗi buổi" min={2} max={100} value={draft.maxTurnsPerSession} onChange={(v) => set({ maxTurnsPerSession: num(v) })} />
        </SimpleGrid>

        <Divider label="Buổi & lượt (Phase 2)" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumberInput label="Buổi thử · lượt" min={0} max={100} value={draft.freeFirstSessionTurns} onChange={(v) => set({ freeFirstSessionTurns: num(v) })} />
          <NumberInput label="Quà chuỗi · mỗi (ngày)" min={0} max={365} value={draft.streakGiftEveryDays} onChange={(v) => set({ streakGiftEveryDays: num(v) })} />
          <NumberInput label="Quà chuỗi · lượt/buổi" min={0} max={100} value={draft.streakGiftSessionTurns} onChange={(v) => set({ streakGiftSessionTurns: num(v) })} />
          <NumberInput label="Premium · buổi/ngày" min={0} max={50} value={draft.premiumSessionsPerDay} onChange={(v) => set({ premiumSessionsPerDay: num(v) })} />
          <NumberInput label="Premium · lượt/buổi" min={0} max={100} value={draft.premiumTurnsPerSession} onChange={(v) => set({ premiumTurnsPerSession: num(v) })} />
          <NumberInput label="Mở rộng · buổi/ngày" min={0} max={50} value={draft.addonSessionsPerDay} onChange={(v) => set({ addonSessionsPerDay: num(v) })} />
          <NumberInput label="Mở rộng · lượt/buổi" min={0} max={100} value={draft.addonTurnsPerSession} onChange={(v) => set({ addonTurnsPerSession: num(v) })} />
          <NumberInput label="Mở rộng · trần lượt/ngày" min={0} max={1000} value={draft.addonDailyTurnCap} onChange={(v) => set({ addonDailyTurnCap: num(v) })} />
        </SimpleGrid>

        <Divider label="Giọng đọc câu trả lời" labelPosition="left" />
        <Text fz="sm" c="dimmed">
          Mặc định mọi người nghe bằng giọng của điện thoại (miễn phí). Bật công tắc dưới đây thì tài khoản Premium nghe giọng Azure: dùng phần miễn phí (F0) trước,
          hết mới dùng resource trả phí (S0), chạm cả hai trần thì tự quay về giọng của điện thoại.
        </Text>
        <Group align="flex-end" gap="lg">
          <Switch
            label="Giọng Azure cho Premium"
            checked={draft.premiumAzureVoice}
            onChange={(e) => set({ premiumAzureVoice: e.currentTarget.checked })}
            mb={8}
          />
          <Select
            label="Giọng Azure"
            w={260}
            allowDeselect={false}
            disabled={!draft.premiumAzureVoice}
            data={d.voices.map((v) => ({ value: v.name, label: `${v.label} · ${v.accent} · ${v.gender}` }))}
            value={draft.azureVoice}
            onChange={(v) => v && set({ azureVoice: v })}
          />
        </Group>
        {draft.premiumAzureVoice && !d.azureConfigured && !d.paidConfigured ? (
          <Alert color="yellow">Máy chủ chưa cấu hình Azure Speech nên Premium vẫn nghe giọng của điện thoại.</Alert>
        ) : null}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Ký tự F0 (miễn phí) mỗi tháng cho đàm thoại"
            description={`F0 có ${fmt(u.speechMonthLimit)} ký tự/tháng, dùng chung với bài nghe, luyện câu, giọng đọc từ`}
            min={0}
            step={10000}
            thousandSeparator="."
            decimalSeparator=","
            value={draft.freeMonthlyChars}
            onChange={(v) => set({ freeMonthlyChars: num(v) })}
          />
          <NumberInput
            label="Ký tự S0 (trả phí) tối đa mỗi tháng"
            description={
              d.paidConfigured
                ? `≈ ${((draft.paidMonthlyChars / 1_000_000) * 15).toFixed(2)} USD · 0 = không bao giờ dùng S0`
                : "Máy chủ chưa có AZURE_SPEECH_PAID_KEY nên không dùng S0"
            }
            min={0}
            step={10000}
            thousandSeparator="."
            decimalSeparator=","
            value={draft.paidMonthlyChars}
            onChange={(v) => set({ paidMonthlyChars: num(v) })}
          />
        </SimpleGrid>

        <Divider label="Tháng này" labelPosition="left" />
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Buổi đàm thoại" value={fmt(u.sessions)} />
          <Stat label="Người dùng" value={fmt(u.users)} />
          <Stat label="Lượt nói" value={fmt(u.learnerTurns)} />
          <Stat
            label="Ký tự Azure F0 / S0"
            value={`${fmt(u.freeChars)} / ${fmt(u.paidChars)}`}
            note={u.paidChars ? `S0 ≈ ${u.paidUsd.toFixed(2)} USD` : `F0 toàn hệ thống: ${fmt(u.speechMonthChars)}/${fmt(u.speechMonthLimit)}`}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={reset} disabled={saving || !d.updatedAt}>
            Về mặc định
          </Button>
          <Button disabled={!changed} loading={saving} onClick={save}>
            Lưu
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Stack gap={0}>
      <Text fz="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
      {note ? (
        <Text fz="xs" c="dimmed">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}
