import { ActionIcon, Alert, Button, Group, Modal, NumberInput, Paper, Skeleton, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconCheck, IconDeviceFloppy, IconHistory, IconPlus, IconRestore, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type AdminPremiumPerks, type PremiumPerk, type PremiumPerks, type PremiumPlan } from "../api";
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
  { value: "create-outline", label: "Bút viết" },
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

  const setPerk = (i: number, perk: PremiumPerk) => setForm({ ...form, perks: form.perks.map((x, j) => (j === i ? perk : x)) });
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
        Trong tiêu đề và mô tả, <b>{"{n}"}</b> được thay bằng số lượt chấm Premium mỗi ngày (trang Cài đặt); <b>{"{ai}"}</b> /{" "}
        <b>{"{aiFree}"}</b> bằng số lượt đàm thoại AI mỗi ngày của Premium / gói miễn phí (trang Đàm thoại AI); <b>{"{w}"}</b> /{" "}
        <b>{"{wFree}"}</b> bằng số bài chấm mỗi ngày của Premium / gói miễn phí (trang Luyện viết AI).
      </Alert>

      <PlansCard
        plans={form.plans}
        showPrices={form.showPrices}
        onChange={(plans) => setForm({ ...form, plans })}
        onShow={(showPrices) => setForm({ ...form, showPrices })}
      />

      <Title order={4} mt="sm">
        Quyền lợi
      </Title>

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
                onMove={(to) => setForm({ ...form, perks: move(form.perks, i, to) })}
                onDelete={() => setForm({ ...form, perks: form.perks.filter((_, j) => j !== i) })}
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
        onClick={() => setForm({ ...form, perks: [...form.perks, newPerk()] })}
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

/** Monthly equivalent and saving against the 1-month plan, the way the app shows them. */
function planSummary(plan: PremiumPlan, monthly: PremiumPlan | undefined): string {
  const perMonth = Math.round(plan.price / plan.months / 100) * 100;
  if (plan.months === 1 || !monthly) return `${perMonth.toLocaleString("vi-VN")}đ/tháng`;
  const saving = Math.round((1 - plan.price / (monthly.price * plan.months)) * 100);
  return `≈ ${perMonth.toLocaleString("vi-VN")}đ/tháng${saving > 0 ? ` · tiết kiệm ${saving}%` : ""}`;
}

function PlansCard({
  plans,
  showPrices,
  onChange,
  onShow,
}: {
  plans: PremiumPlan[];
  showPrices: boolean;
  onChange: (plans: PremiumPlan[]) => void;
  onShow: (show: boolean) => void;
}) {
  const monthly = plans.find((p) => p.months === 1);
  const setPlan = (i: number, plan: PremiumPlan) => onChange(plans.map((x, j) => (j === i ? plan : x)));
  const nextMonths = [1, 3, 6, 12, 24].find((m) => !plans.some((p) => p.months === m)) ?? 0;

  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Bảng giá</Title>
            <Text fz="sm" c="dimmed">
              Hiện trên màn Premium với nhãn “Sắp mở bán” cho tới khi app có mua trong ứng dụng. Giá nên khớp với giá đặt trên App Store / Google Play.
            </Text>
          </div>
          <Switch checked={showPrices} onChange={(e) => onShow(e.currentTarget.checked)} label={showPrices ? "Đang hiện" : "Đang ẩn"} />
        </Group>
        {plans.map((plan, i) => (
          <Group key={i} gap="xs" wrap="wrap" align="flex-end" style={{ opacity: plan.visible ? 1 : 0.65 }}>
            <NumberInput
              w={110}
              label="Số tháng"
              min={1}
              max={36}
              value={plan.months}
              onChange={(v) => setPlan(i, { ...plan, months: typeof v === "number" ? Math.max(1, Math.round(v)) : 1 })}
            />
            <NumberInput
              w={150}
              label="Giá"
              min={1000}
              max={10000000}
              step={1000}
              thousandSeparator="."
              decimalSeparator=","
              suffix="đ"
              value={plan.price}
              onChange={(v) => setPlan(i, { ...plan, price: typeof v === "number" ? Math.round(v) : 0 })}
            />
            <TextInput
              w={170}
              label="Nhãn nổi bật"
              placeholder="VD: Tiết kiệm nhất"
              maxLength={30}
              value={plan.badge}
              onChange={(e) => setPlan(i, { ...plan, badge: e.currentTarget.value })}
            />
            <Text fz="sm" c="dimmed" pb={8} miw={190}>
              {planSummary(plan, monthly)}
            </Text>
            <Switch
              pb={8}
              checked={plan.visible}
              onChange={(e) => setPlan(i, { ...plan, visible: e.currentTarget.checked })}
              label={plan.visible ? "Hiện" : "Ẩn"}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              mb={4}
              onClick={() => onChange(plans.filter((_, j) => j !== i))}
              aria-label="Xoá gói"
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="default"
          leftSection={<IconPlus size={18} />}
          onClick={() => onChange([...plans, { months: nextMonths, price: (monthly?.price ?? 19000) * nextMonths, badge: "", visible: true }])}
          disabled={plans.length >= 4 || nextMonths === 0}
          style={{ alignSelf: "flex-start" }}
        >
          Thêm gói
        </Button>
      </Stack>
    </Paper>
  );
}
