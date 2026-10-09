import {
  ActionIcon,
  Alert,
  Button,
  Chip,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconCheck, IconDeviceFloppy, IconHistory, IconRestore } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api, type AdminSettings, type NotificationConfig } from "../api";
import { Select } from "../components/AppSelect";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { WEEKDAY_NAMES } from "../history/meta";
import { fullTime, notifyError, notifySaved } from "../lib";
import { DayTimeline } from "../settings/DayTimeline";
import { LIMITS, validate } from "../settings/notificationRules";

const LOCAL_DAYS = Array.from({ length: LIMITS.maxComebackLocal }, (_, i) => i + 1);
const PUSH_DAYS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60];
/** Monday first, the way Vietnamese calendars read. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAY_NAMES[d] }));

export function SettingsPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const stored = settings.data?.notifications.value ?? null;
  const defaults = settings.data?.notifications.defaults ?? null;
  const [form, setForm] = useState<NotificationConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (stored) setForm(stored);
  }, [stored]);

  const dirty = !!form && !!stored && JSON.stringify(form) !== JSON.stringify(stored);
  const atDefaults = !!stored && !!defaults && JSON.stringify(stored) === JSON.stringify(defaults);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (settings.error) return <Alert color="red">{(settings.error as Error).message}</Alert>;
  if (!form || !defaults || !settings.data) {
    return (
      <Stack maw={900}>
        <Skeleton h={60} radius="lg" />
        <Skeleton h={300} radius="lg" />
      </Stack>
    );
  }

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const set = <K extends keyof NotificationConfig>(key: K, value: NotificationConfig[K]) => setForm({ ...form, [key]: value });
  /** "Mặc định: …" under a field whose value differs from the default. */
  const hint = (key: keyof NotificationConfig, show = (v: unknown) => String(v)) =>
    JSON.stringify(form[key]) !== JSON.stringify(defaults[key]) ? `Mặc định: ${show(defaults[key])}` : undefined;
  const days = (v: unknown) => ((v as number[]).length ? `ngày ${(v as number[]).join(", ")}` : "tắt");

  function applied(next: AdminSettings, message: string) {
    queryClient.setQueryData(["settings"], next);
    queryClient.invalidateQueries({ queryKey: ["audit"] });
    notifySaved(message);
  }

  async function save() {
    if (!form || hasErrors) return;
    setSaving(true);
    try {
      applied(await api.saveNotificationSettings(form), "Đã lưu cài đặt. App sẽ dùng thông số mới ở lần mở tiếp theo.");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      applied(await api.resetNotificationSettings(), "Đã khôi phục mặc định");
      setConfirmReset(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  const saveButton = dirty ? (
    <Button leftSection={<IconDeviceFloppy size={18} />} onClick={save} loading={saving} disabled={hasErrors} miw={140} flex={desktop ? undefined : 1}>
      Lưu thay đổi
    </Button>
  ) : (
    <Button variant="light" leftSection={<IconCheck size={18} />} miw={140} flex={desktop ? undefined : 1} style={{ cursor: "default" }}>
      Đã lưu
    </Button>
  );

  const actions = desktop ? (
    <>
      <Button variant="default" leftSection={<IconHistory size={18} />} onClick={() => setHistoryOpen(true)}>
        Lịch sử
      </Button>
      <Button variant="default" leftSection={<IconRestore size={18} />} onClick={() => setConfirmReset(true)} disabled={atDefaults && !dirty}>
        Mặc định
      </Button>
      {dirty ? (
        <Button variant="subtle" color="gray" onClick={() => setForm(stored)}>
          Huỷ
        </Button>
      ) : null}
      {saveButton}
    </>
  ) : (
    <>
      <ActionIcon variant="default" size={42} radius="md" onClick={() => setHistoryOpen(true)} aria-label="Lịch sử">
        <IconHistory size={20} />
      </ActionIcon>
      <ActionIcon variant="default" size={42} radius="md" onClick={() => setConfirmReset(true)} disabled={atDefaults && !dirty} aria-label="Khôi phục mặc định">
        <IconRestore size={20} />
      </ActionIcon>
      {saveButton}
    </>
  );

  return (
    <Stack gap="md" maw={900} pb={desktop ? 0 : 80}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Cài đặt hệ thống</Title>
          <Text c="dimmed" fz="sm">
            Áp dụng cho mọi người dùng, không cần cập nhật app.{" "}
            {settings.data.notifications.updatedAt ? `Sửa lần cuối ${fullTime(settings.data.notifications.updatedAt)}.` : "Đang dùng giá trị mặc định."}
          </Text>
        </div>
        {desktop ? <Group gap="sm">{actions}</Group> : null}
      </Group>

      <Section title="Thông báo · Giờ gửi" description="Giờ địa phương của từng người dùng.">
        <DayTimeline config={form} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
          <TimeField
            label="Giờ cứu chuỗi"
            description={`Nhắc người đang có chuỗi mà hôm đó chưa học.`}
            value={form.rescueTime}
            onChange={(v) => set("rescueTime", v)}
            error={errors.rescueTime}
            hint={hint("rescueTime")}
          />
          <Group grow gap="sm" align="flex-start">
            <TimeField
              label="Yên tĩnh từ"
              description="Không gửi gì"
              value={form.quietStart}
              onChange={(v) => set("quietStart", v)}
              error={errors.quietStart}
              hint={hint("quietStart")}
            />
            <TimeField
              label="đến"
              description="hôm sau"
              value={form.quietEnd}
              onChange={(v) => set("quietEnd", v)}
              error={errors.quietEnd}
              hint={hint("quietEnd")}
            />
          </Group>
          <Group grow gap="sm" align="flex-start">
            <Select
              label="Tổng kết tuần"
              description="Ngày gửi"
              data={WEEKDAYS}
              value={String(form.weeklyDay)}
              onChange={(v) => v && set("weeklyDay", Number(v))}
              allowDeselect={false}
            />
            <TimeField
              label="Lúc"
              description="Giờ gửi"
              value={form.weeklyTime}
              onChange={(v) => set("weeklyTime", v)}
              error={errors.weeklyTime}
              hint={hint("weeklyTime") ?? (form.weeklyDay !== defaults.weeklyDay ? `Mặc định: ${WEEKDAY_NAMES[defaults.weeklyDay]}` : undefined)}
            />
          </Group>
          <TimeField
            label="Giờ báo dùng lượt đóng băng"
            description="Sáng hôm sau ngày bị lỡ."
            value={form.freezeNoticeTime}
            onChange={(v) => set("freezeNoticeTime", v)}
            error={errors.freezeNoticeTime}
            hint={hint("freezeNoticeTime")}
          />
        </SimpleGrid>
        <Text fz="xs" c="dimmed" mt="sm">
          Tổng kết tuần và báo đóng băng là thông báo đẩy từ server, sẽ chạy khi có giai đoạn thông báo 2. Nhắc hằng ngày, cứu chuỗi và nhắc quay lại
          đang chạy trên máy người dùng.
        </Text>
      </Section>

      <Section title="Thông báo · Giới hạn">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <div>
            <Text fz="md" fw={500}>
              Tối đa mỗi ngày
            </Text>
            <Text fz="sm" c="dimmed" mb={6}>
              Không tính tin chung admin gửi. Đặt 1 thì không có nhắc cứu chuỗi.
            </Text>
            <SegmentedControl
              fullWidth
              data={Array.from({ length: LIMITS.maxPerDay }, (_, i) => String(i + 1))}
              value={String(form.maxPerDay)}
              onChange={(v) => set("maxPerDay", Number(v))}
            />
            <Hint text={hint("maxPerDay")} />
          </div>
          <NumberInput
            label="Chuỗi tối thiểu để nhắc cứu chuỗi"
            description="Chuỗi ngắn hơn thì không nhắc."
            min={1}
            max={LIMITS.maxRescueMinStreak}
            suffix=" ngày"
            value={form.rescueMinStreak}
            onChange={(v) => set("rescueMinStreak", typeof v === "number" ? v : 1)}
            error={errors.rescueMinStreak}
            inputWrapperOrder={["label", "description", "input", "error"]}
          />
        </SimpleGrid>
        <Hint text={hint("rescueMinStreak")} />
      </Section>

      <Section title="Thông báo · Nhắc quay lại" description="Số ngày kể từ lần học cuối. Bỏ chọn hết là tắt.">
        <Stack gap="md">
          <div>
            <Text fz="md" fw={500}>
              Trên máy
            </Text>
            <Text fz="sm" c="dimmed" mb={6}>
              Đang dùng. Tối đa {LIMITS.maxComebackLocal} ngày vì app hẹn lịch trước 1 tuần.
            </Text>
            <DayChips options={LOCAL_DAYS} value={form.comebackDaysLocal} onChange={(v) => set("comebackDaysLocal", v)} />
            <Hint text={hint("comebackDaysLocal", days)} />
          </div>
          <div>
            <Text fz="md" fw={500}>
              Từ server
            </Text>
            <Text fz="sm" c="dimmed" mb={6}>
              Dùng khi có thông báo đẩy.
            </Text>
            <DayChips
              options={[...new Set([...PUSH_DAYS, ...form.comebackDaysPush])].sort((a, b) => a - b)}
              value={form.comebackDaysPush} onChange={(v) => set("comebackDaysPush", v)} />
            {errors.comebackDaysPush ? (
              <Text fz="xs" c="red" mt={4}>
                {errors.comebackDaysPush}
              </Text>
            ) : null}
            <Hint text={hint("comebackDaysPush", days)} />
          </div>
        </Stack>
      </Section>

      {!desktop ? (
        <Paper shadow="md" p="sm" style={{ position: "fixed", left: 0, right: 0, bottom: 64, zIndex: 50, borderRadius: 0 }}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      <Modal opened={confirmReset} onClose={() => setConfirmReset(false)} title="Khôi phục mặc định?" centered>
        <Stack>
          <Text fz="sm">Mọi thông số thông báo trở về giá trị mặc định. Bản hiện tại vẫn nằm trong lịch sử nên có thể quay lại.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmReset(false)}>
              Huỷ
            </Button>
            <Button leftSection={<IconRestore size={18} />} loading={saving} onClick={reset}>
              Khôi phục
            </Button>
          </Group>
        </Stack>
      </Modal>
      <HistoryDrawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="settings"
        entityId="notifications"
        title="Thông số thông báo"
        onRestored={() => setHistoryOpen(false)}
      />
    </Stack>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Text fw={700} fz="sm" tt="uppercase" c="dimmed">
        {title}
      </Text>
      {description ? (
        <Text fz="xs" c="dimmed" mb="sm">
          {description}
        </Text>
      ) : (
        <div style={{ height: 8 }} />
      )}
      {children}
    </Paper>
  );
}

function TimeField(props: { label: string; description?: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <div>
      <TextInput
        type="time"
        label={props.label}
        description={props.description}
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        error={props.error}
        inputWrapperOrder={["label", "description", "input", "error"]}
      />
      <Hint text={props.hint} />
    </div>
  );
}

function Hint({ text }: { text?: string }) {
  return text ? (
    <Text fz="xs" c="orange.8" mt={4}>
      {text}
    </Text>
  ) : null;
}

function DayChips({ options, value, onChange }: { options: number[]; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <Chip.Group multiple value={value.map(String)} onChange={(v) => onChange(v.map(Number).sort((a, b) => a - b))}>
      <Group gap={6}>
        {options.map((d) => (
          <Chip key={d} value={String(d)} size="sm" radius="md">
            {d} ngày
          </Chip>
        ))}
      </Group>
    </Chip.Group>
  );
}
