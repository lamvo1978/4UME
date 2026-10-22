import { Alert, Button, Divider, Group, Input, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type AiProvider, type WritingConfig } from "../api";
import { notifyError, notifySaved } from "../lib";

export const WRITING_CONFIG_KEY = ["writing-config"];

const num = (v: string | number) => (typeof v === "number" ? v : 0);
const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Checks per day, the shared daily cap with its Premium reserve, what free learners see, and which AI grades. */
export function WritingConfigCard() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: WRITING_CONFIG_KEY, queryFn: api.writingConfig });
  const [draft, setDraft] = useState<WritingConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config.data) setDraft(config.data.value);
  }, [config.data]);

  if (config.error) return <Alert color="red">{(config.error as Error).message}</Alert>;
  if (!draft || !config.data) return null;
  const d = config.data;
  const u = d.usage;
  const changed = JSON.stringify(draft) !== JSON.stringify(d.value);
  const set = (patch: Partial<WritingConfig>) => setDraft({ ...draft, ...patch });
  const ready = draft.providers.some((key) => d.providers.find((p) => p.key === key)?.configured);
  const freeShare = draft.dailyTotalCap > 0 ? Math.floor((draft.dailyTotalCap * (100 - draft.premiumReservePercent)) / 100) : 0;
  const models = Object.entries(u.models).sort((a, b) => b[1] - a[1]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      queryClient.setQueryData(WRITING_CONFIG_KEY, await api.saveWritingConfig(draft));
      notifySaved("Đã lưu cài đặt luyện viết");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!window.confirm("Đưa cài đặt luyện viết về mặc định?")) return;
    setSaving(true);
    try {
      queryClient.setQueryData(WRITING_CONFIG_KEY, await api.resetWritingConfig());
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
          <Switch label="Bật luyện viết trong app" checked={draft.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
        </Group>
        {!ready ? (
          <Alert color="yellow">
            Chưa AI nào trong thứ tự chấm có key trên máy chủ (<b>MISTRAL_API_KEY</b>, <b>GROQ_API_KEY</b>), app sẽ báo tính năng chưa sẵn sàng.
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput label="Bài chấm mỗi ngày · miễn phí" min={0} max={1000} value={draft.freeDailyChecks} onChange={(v) => set({ freeDailyChecks: num(v) })} />
          <NumberInput
            label="Bài chấm mỗi ngày · Premium"
            min={0}
            max={1000}
            value={draft.premiumDailyChecks}
            onChange={(v) => set({ premiumDailyChecks: num(v) })}
          />
          <NumberInput
            label="Trần tổng mỗi ngày (mọi người)"
            description="Giữ trong hạn mức miễn phí của AI; tính theo ngày UTC (7 giờ sáng giờ Việt Nam). 0 = không giới hạn"
            min={0}
            max={100000}
            value={draft.dailyTotalCap}
            onChange={(v) => set({ dailyTotalCap: num(v) })}
          />
          <NumberInput
            label="Phần để dành cho Premium (%)"
            description={
              draft.dailyTotalCap > 0
                ? `Gói miễn phí dừng khi cả hệ thống đã chấm ${fmt(freeShare)} bài trong ngày`
                : "Chỉ có tác dụng khi có trần tổng"
            }
            min={0}
            max={100}
            value={draft.premiumReservePercent}
            onChange={(v) => set({ premiumReservePercent: num(v) })}
          />
          <NumberInput
            label="Bài cũ gói miễn phí xem lại được"
            description="Premium xem được tất cả"
            min={0}
            max={1000}
            value={draft.freeHistoryCount}
            onChange={(v) => set({ freeHistoryCount: num(v) })}
          />
          <Switch
            mt="lg"
            label="Bản viết lại chỉ dành cho Premium"
            description="Gói miễn phí thấy câu đầu, phần còn lại bị khoá"
            checked={draft.rewritePremiumOnly}
            onChange={(e) => set({ rewritePremiumOnly: e.currentTarget.checked })}
          />
        </SimpleGrid>

        <Divider label="AI chấm bài" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <ProviderOrder label="Thứ tự AI · gói miễn phí" providers={d.providers} value={draft.providers} onChange={(v) => set({ providers: v })} />
          <ProviderOrder
            label="Thứ tự AI · Premium"
            providers={d.providers}
            value={draft.premiumProviders}
            onChange={(v) => set({ premiumProviders: v })}
            emptyLabel="Giống gói miễn phí"
          />
        </SimpleGrid>
        <Text fz="xs" c="dimmed">
          AI đầu lỗi, hết lượt hoặc chậm quá thì tự chuyển sang AI kế tiếp; cả chuỗi phải xong trong khoảng 50 giây.{" "}
          {d.providers.map((p) => `${p.name}: ${p.configured ? p.model : "chưa có key"}`).join(" · ")}
        </Text>

        <Divider label="Thống kê" labelPosition="left" />
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Hôm nay (UTC)" value={draft.dailyTotalCap > 0 ? `${fmt(u.today)} / ${fmt(draft.dailyTotalCap)}` : fmt(u.today)} />
          <Stat label="Bài trong tháng" value={fmt(u.month)} />
          <Stat label="Người viết trong tháng" value={fmt(u.users)} />
          <Stat label="Điểm trung bình" value={u.month ? String(u.averageScore) : "–"} />
        </SimpleGrid>
        {models.length ? (
          <Text fz="xs" c="dimmed">
            Model đã chấm tháng này: {models.map(([m, c]) => `${m} (${fmt(c)})`).join(" · ")}
          </Text>
        ) : null}

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

/** Up to three providers in order; clearing a slot removes it. */
function ProviderOrder({
  label,
  providers,
  value,
  onChange,
  emptyLabel,
}: {
  label: string;
  providers: AiProvider[];
  value: string[];
  onChange: (v: string[]) => void;
  emptyLabel?: string;
}) {
  const slots = Math.min(providers.length, value.length + 1);
  const name = (key: string) => providers.find((p) => p.key === key);
  return (
    <Input.Wrapper label={label} description={value.length === 0 && emptyLabel ? emptyLabel : undefined}>
      <Stack gap={6} mt={6}>
        {Array.from({ length: slots }, (_, i) => (
          <Select
            key={i}
            size="sm"
            placeholder={i === 0 ? emptyLabel ?? "Chọn AI" : "Thêm AI dự phòng"}
            clearable
            value={value[i] ?? null}
            data={providers
              .filter((p) => p.key === value[i] || !value.includes(p.key))
              .map((p) => ({ value: p.key, label: `${i + 1}. ${p.name}${p.configured ? "" : " (chưa có key)"}` }))}
            onChange={(v) => {
              const next = [...value];
              if (v) next[i] = v;
              else next.splice(i, 1);
              onChange(next.filter(Boolean));
            }}
            error={value[i] && !name(value[i])?.configured ? "Chưa có key, sẽ bị bỏ qua" : undefined}
          />
        ))}
      </Stack>
    </Input.Wrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text fz="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </Stack>
  );
}
