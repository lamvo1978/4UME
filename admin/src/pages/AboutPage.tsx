import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconDeviceFloppy,
  IconHistory,
  IconLock,
  IconPlus,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type AboutContent, type AboutItem, type AboutSection, type AdminAbout } from "../api";
import { Select } from "../components/AppSelect";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { mobileActionBarStyle } from "../layout/mobileActionBar";
import { fullTime, notifyError, notifySaved } from "../lib";

/** Same list as AboutRules.Icons on the server (Ionicons names used by the app). */
const ICONS = [
  { value: "book-outline", label: "Sách" },
  { value: "document-text-outline", label: "Tài liệu" },
  { value: "headset-outline", label: "Tai nghe" },
  { value: "mic-outline", label: "Micro" },
  { value: "volume-medium-outline", label: "Loa" },
  { value: "pulse-outline", label: "Sóng âm" },
  { value: "image-outline", label: "Ảnh" },
  { value: "color-palette-outline", label: "Bảng màu" },
  { value: "information-circle-outline", label: "Thông tin" },
  { value: "school-outline", label: "Trường học" },
  { value: "sparkles-outline", label: "Lấp lánh" },
  { value: "heart-outline", label: "Trái tim" },
  { value: "globe-outline", label: "Quả địa cầu" },
  { value: "mail-outline", label: "Thư" },
  { value: "shield-checkmark-outline", label: "Khiên" },
  { value: "bulb-outline", label: "Bóng đèn" },
  { value: "people-outline", label: "Mọi người" },
  { value: "code-slash-outline", label: "Mã nguồn" },
];

const CEFRJ_CITATION =
  "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://www.cefr-j.org/download.html on 08/10/2026.";

const newItem = (): AboutItem => ({ icon: "information-circle-outline", title: "", body: "", url: null, visible: true });
const newSection = (): AboutSection => ({ title: "", items: [newItem()], visible: true });

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function AboutPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const about = useQuery({ queryKey: ["about"], queryFn: api.about });
  const stored = about.data?.value ?? null;
  const [form, setForm] = useState<AboutContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (stored) setForm(stored);
  }, [stored]);

  const dirty = !!form && !!stored && JSON.stringify(form) !== JSON.stringify(stored);
  const atDefaults = !!about.data && JSON.stringify(about.data.value) === JSON.stringify(about.data.defaults);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (about.error) return <Alert color="red">{(about.error as Error).message}</Alert>;
  if (!form || !about.data) {
    return (
      <Stack maw={900}>
        <Skeleton h={60} radius="lg" />
        <Skeleton h={300} radius="lg" />
      </Stack>
    );
  }

  const setSection = (i: number, s: AboutSection) => setForm({ ...form, sections: form.sections.map((x, j) => (j === i ? s : x)) });
  const setItem = (si: number, ii: number, item: AboutItem) =>
    setSection(si, { ...form.sections[si], items: form.sections[si].items.map((x, j) => (j === ii ? item : x)) });

  async function run(action: () => Promise<AdminAbout>, message: string) {
    setSaving(true);
    try {
      queryClient.setQueryData(["about"], await action());
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      notifySaved(message);
      setConfirmReset(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  const save = () => run(() => api.saveAbout(form), "Đã lưu. App hiện nội dung mới ở lần mở màn Giới thiệu tiếp theo.");

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
          <Title order={2}>Giới thiệu app</Title>
          <Text c="dimmed" fz="sm">
            Màn <b>Hồ sơ → Giới thiệu & bản quyền</b> trong app.{" "}
            {about.data.updatedAt ? `Sửa lần cuối ${fullTime(about.data.updatedAt)}.` : "Đang dùng nội dung mặc định."}
          </Text>
        </div>
        {desktop ? <Group gap="sm">{actions}</Group> : null}
      </Group>

      <Paper p="md" radius="lg" shadow="xs">
        <Textarea
          label="Câu giới thiệu"
          description="Hiện dưới logo và số phiên bản."
          autosize
          minRows={2}
          maxLength={300}
          value={form.tagline}
          onChange={(e) => setForm({ ...form, tagline: e.currentTarget.value })}
        />
      </Paper>

      {form.sections.map((section, si) => (
        <Paper key={si} p="md" radius="lg" shadow="xs" style={{ opacity: section.visible ? 1 : 0.65 }}>
          <Stack gap="sm">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput
                flex={1}
                label={`Mục ${si + 1}`}
                placeholder="Tiêu đề mục"
                maxLength={80}
                value={section.title}
                onChange={(e) => setSection(si, { ...section, title: e.currentTarget.value })}
              />
              <Order
                index={si}
                count={form.sections.length}
                onMove={(to) => setForm({ ...form, sections: move(form.sections, si, to) })}
                onDelete={() => setForm({ ...form, sections: form.sections.filter((_, j) => j !== si) })}
                label="mục"
              />
            </Group>
            <Switch
              checked={section.visible}
              onChange={(e) => setSection(si, { ...section, visible: e.currentTarget.checked })}
              label={section.visible ? "Đang hiện trong app" : "Đang ẩn"}
            />

            {section.items.map((item, ii) => (
              <Paper key={ii} withBorder radius="md" p="sm" style={{ opacity: item.visible ? 1 : 0.65 }}>
                <Stack gap="xs">
                  <Group gap="xs" wrap="nowrap" align="flex-end">
                    <Select
                      w={140}
                      label="Biểu tượng"
                      data={ICONS}
                      value={item.icon}
                      onChange={(v) => v && setItem(si, ii, { ...item, icon: v })}
                      allowDeselect={false}
                    />
                    <TextInput
                      flex={1}
                      label="Tiêu đề"
                      maxLength={80}
                      value={item.title}
                      onChange={(e) => setItem(si, ii, { ...item, title: e.currentTarget.value })}
                    />
                    <Order
                      index={ii}
                      count={section.items.length}
                      onMove={(to) => setSection(si, { ...section, items: move(section.items, ii, to) })}
                      onDelete={() => setSection(si, { ...section, items: section.items.filter((_, j) => j !== ii) })}
                      label="dòng"
                    />
                  </Group>
                  <Textarea
                    label="Nội dung"
                    autosize
                    minRows={2}
                    maxLength={600}
                    value={item.body}
                    onChange={(e) => setItem(si, ii, { ...item, body: e.currentTarget.value })}
                  />
                  <Group gap="sm" align="flex-end" wrap="wrap">
                    <TextInput
                      flex={1}
                      miw={220}
                      label="Liên kết (không bắt buộc)"
                      placeholder="https://…"
                      value={item.url ?? ""}
                      onChange={(e) => setItem(si, ii, { ...item, url: e.currentTarget.value || null })}
                    />
                    <Switch
                      mb={8}
                      checked={item.visible}
                      onChange={(e) => setItem(si, ii, { ...item, visible: e.currentTarget.checked })}
                      label={item.visible ? "Hiện" : "Ẩn"}
                    />
                  </Group>
                </Stack>
              </Paper>
            ))}

            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => setSection(si, { ...section, items: [...section.items, newItem()] })}
              disabled={section.items.length >= 12}
              style={{ alignSelf: "flex-start" }}
            >
              Thêm dòng
            </Button>
          </Stack>
        </Paper>
      ))}

      <Button
        variant="default"
        leftSection={<IconPlus size={18} />}
        onClick={() => setForm({ ...form, sections: [...form.sections, newSection()] })}
        disabled={form.sections.length >= 12}
        style={{ alignSelf: "flex-start" }}
      >
        Thêm mục
      </Button>

      <Paper p="md" radius="lg" shadow="xs" bg="gray.0">
        <Group gap="xs" mb={6}>
          <IconLock size={16} />
          <Text fw={700} fz="sm">
            Nguồn dữ liệu · trích dẫn CEFR-J
          </Text>
          <Badge variant="light" color="gray">
            Cố định
          </Badge>
        </Group>
        <Text fz="sm" fs="italic">
          {CEFRJ_CITATION}
        </Text>
        <Text fz="xs" c="dimmed" mt={6}>
          Giấy phép CEFR-J bắt buộc hiện trích dẫn này nên app luôn hiển thị, không sửa hay ẩn ở đây.
        </Text>
      </Paper>

      {!desktop ? (
        <Paper shadow="md" p="sm" style={mobileActionBarStyle}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      <Modal opened={confirmReset} onClose={() => setConfirmReset(false)} title="Khôi phục nội dung mặc định?" centered>
        <Stack>
          <Text fz="sm">Toàn bộ nội dung Giới thiệu trở về bản mặc định. Bản hiện tại vẫn nằm trong lịch sử nên có thể quay lại.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmReset(false)}>
              Huỷ
            </Button>
            <Button leftSection={<IconRestore size={18} />} loading={saving} onClick={() => run(api.resetAbout, "Đã khôi phục mặc định")}>
              Khôi phục
            </Button>
          </Group>
        </Stack>
      </Modal>
      <HistoryDrawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="settings"
        entityId="about"
        title="Giới thiệu app"
        onRestored={() => setHistoryOpen(false)}
      />
    </Stack>
  );
}

function Order({
  index,
  count,
  onMove,
  onDelete,
  label,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onDelete: () => void;
  label: string;
}) {
  return (
    <Group gap={4} wrap="nowrap" mb={2}>
      <ActionIcon variant="default" size={34} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Đưa ${label} lên`}>
        <IconArrowUp size={16} />
      </ActionIcon>
      <ActionIcon variant="default" size={34} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Đưa ${label} xuống`}>
        <IconArrowDown size={16} />
      </ActionIcon>
      <ActionIcon variant="default" color="red" size={34} onClick={onDelete} aria-label={`Xoá ${label}`}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
}
