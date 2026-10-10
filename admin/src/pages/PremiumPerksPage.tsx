import { ActionIcon, Alert, Button, Group, Modal, Paper, Skeleton, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconCheck, IconDeviceFloppy, IconHistory, IconPlus, IconRestore } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type AdminPremiumPerks, type PremiumPerk, type PremiumPerks } from "../api";
import { Select } from "../components/AppSelect";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { mobileActionBarStyle } from "../layout/mobileActionBar";
import { fullTime, notifyError, notifySaved } from "../lib";
import { move, Order } from "./AboutPage";

/** Same list as PremiumPerkRules.Icons on the server (Ionicons names used by the app). */
const ICONS = [
  { value: "pulse-outline", label: "Sóng âm" },
  { value: "ban-outline", label: "Cấm" },
  { value: "stats-chart-outline", label: "Biểu đồ" },
  { value: "snow-outline", label: "Bông tuyết" },
  { value: "cloud-download-outline", label: "Tải về" },
  { value: "heart-outline", label: "Trái tim" },
  { value: "chatbubbles-outline", label: "Hội thoại" },
  { value: "school-outline", label: "Trường học" },
  { value: "ribbon-outline", label: "Huy hiệu" },
  { value: "sparkles-outline", label: "Lấp lánh" },
  { value: "mic-outline", label: "Micro" },
  { value: "headset-outline", label: "Tai nghe" },
  { value: "book-outline", label: "Sách" },
  { value: "trophy-outline", label: "Cúp" },
  { value: "flame-outline", label: "Ngọn lửa" },
  { value: "time-outline", label: "Đồng hồ" },
  { value: "infinite-outline", label: "Vô hạn" },
  { value: "star-outline", label: "Ngôi sao" },
];

const newPerk = (): PremiumPerk => ({ icon: "sparkles-outline", title: "", body: "", soon: true, visible: true });

export function PremiumPerksPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["premium-perks"], queryFn: api.premiumPerks });
  const stored = query.data?.value ?? null;
  const [form, setForm] = useState<PremiumPerks | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (stored) setForm(stored);
  }, [stored]);

  const dirty = !!form && !!stored && JSON.stringify(form) !== JSON.stringify(stored);
  const atDefaults = !!query.data && JSON.stringify(query.data.value) === JSON.stringify(query.data.defaults);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (query.error) return <Alert color="red">{(query.error as Error).message}</Alert>;
  if (!form || !query.data) {
    return (
      <Stack maw={900}>
        <Skeleton h={60} radius="lg" />
        <Skeleton h={300} radius="lg" />
      </Stack>
    );
  }

  const setPerk = (i: number, perk: PremiumPerk) => setForm({ perks: form.perks.map((x, j) => (j === i ? perk : x)) });
  const soonShown = form.perks.filter((p) => p.visible && p.soon).length;

  async function run(action: () => Promise<AdminPremiumPerks>, message: string) {
    setSaving(true);
    try {
      queryClient.setQueryData(["premium-perks"], await action());
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      notifySaved(message);
      setConfirmReset(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  const save = () => run(() => api.savePremiumPerks(form), "Đã lưu. App hiện danh sách mới ở lần mở màn Premium tiếp theo.");

  const saveButton = dirty ? (
    <Button leftSection={<IconDeviceFloppy size={18} />} onClick={save} loading={saving} miw={140} flex={desktop ? undefined : 1}>
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
          <Title order={2}>Quyền lợi Premium</Title>
          <Text c="dimmed" fz="sm">
            Danh sách trên màn <b>Premium</b> trong app.{" "}
            {query.data.updatedAt ? `Sửa lần cuối ${fullTime(query.data.updatedAt)}.` : "Đang dùng danh sách mặc định."}
          </Text>
        </div>
        {desktop ? <Group gap="sm">{actions}</Group> : null}
      </Group>

      <Alert color={soonShown > 0 ? "yellow" : "teal"} variant="light">
        {soonShown > 0
          ? `Đang hiện ${soonShown} quyền lợi "Sắp có". Trước khi mở bán Premium qua App Store / Google Play, hãy ẩn những dòng chưa làm: cửa hàng thường từ chối màn mua hứa tính năng chưa có.`
          : "Mọi quyền lợi đang hiện đều đã có thật."}{" "}
        Trong tiêu đề, <b>{"{n}"}</b> được thay bằng số lượt chấm Premium mỗi ngày (trang Cài đặt).
      </Alert>

      {form.perks.map((perk, i) => (
        <Paper key={i} p="md" radius="lg" shadow="xs" style={{ opacity: perk.visible ? 1 : 0.65 }}>
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <Select
                w={170}
                label="Biểu tượng"
                data={ICONS}
                value={perk.icon}
                onChange={(v) => v && setPerk(i, { ...perk, icon: v })}
                allowDeselect={false}
              />
              <TextInput
                flex={1}
                label={`Quyền lợi ${i + 1}`}
                placeholder="Tiêu đề"
                maxLength={80}
                value={perk.title}
                onChange={(e) => setPerk(i, { ...perk, title: e.currentTarget.value })}
              />
              <Order
                index={i}
                count={form.perks.length}
                onMove={(to) => setForm({ perks: move(form.perks, i, to) })}
                onDelete={() => setForm({ perks: form.perks.filter((_, j) => j !== i) })}
                label="dòng"
              />
            </Group>
            <TextInput
              label="Mô tả ngắn"
              maxLength={200}
              value={perk.body}
              onChange={(e) => setPerk(i, { ...perk, body: e.currentTarget.value })}
            />
            <Group gap="lg">
              <Switch
                checked={perk.visible}
                onChange={(e) => setPerk(i, { ...perk, visible: e.currentTarget.checked })}
                label={perk.visible ? "Đang hiện trong app" : "Đang ẩn"}
              />
              <Switch
                color="yellow"
                checked={perk.soon}
                onChange={(e) => setPerk(i, { ...perk, soon: e.currentTarget.checked })}
                label='Nhãn "Sắp có"'
              />
            </Group>
          </Stack>
        </Paper>
      ))}

      <Button
        variant="default"
        leftSection={<IconPlus size={18} />}
        onClick={() => setForm({ perks: [...form.perks, newPerk()] })}
        disabled={form.perks.length >= 12}
        style={{ alignSelf: "flex-start" }}
      >
        Thêm quyền lợi
      </Button>

      {!desktop ? (
        <Paper shadow="md" p="sm" style={mobileActionBarStyle}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      <Modal opened={confirmReset} onClose={() => setConfirmReset(false)} title="Khôi phục danh sách mặc định?" centered>
        <Stack>
          <Text fz="sm">Danh sách quyền lợi trở về bản mặc định. Bản hiện tại vẫn nằm trong lịch sử nên có thể quay lại.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmReset(false)}>
              Huỷ
            </Button>
            <Button leftSection={<IconRestore size={18} />} loading={saving} onClick={() => run(api.resetPremiumPerks, "Đã khôi phục mặc định")}>
              Khôi phục
            </Button>
          </Group>
        </Stack>
      </Modal>
      <HistoryDrawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="settings"
        entityId="premium"
        title="Quyền lợi Premium"
        onRestored={() => setHistoryOpen(false)}
      />
    </Stack>
  );
}
