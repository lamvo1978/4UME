import { ActionIcon, Alert, Anchor, Button, Group, Modal, NumberInput, Paper, SimpleGrid, Skeleton, Stack, TagsInput, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowLeft, IconCheck, IconDeviceFloppy, IconHistory, IconPlus, IconRestore } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminFeedbackSettings, type FeedbackReplyTemplate, type FeedbackSettings } from "../api";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { mobileActionBarStyle } from "../layout/mobileActionBar";
import { fullTime, notifyError, notifySaved } from "../lib";
import { move, Order } from "./AboutPage";

const MAX_RECIPIENTS = 5;
const MAX_REPLIES = 20;

export function FeedbackSettingsPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["feedback-settings"], queryFn: api.feedbackSettings });
  const stored = query.data?.value ?? null;
  const [form, setForm] = useState<FeedbackSettings | null>(null);
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

  const setReply = (i: number, r: FeedbackReplyTemplate) => setForm({ ...form, replies: form.replies.map((x, j) => (j === i ? r : x)) });

  async function run(action: () => Promise<AdminFeedbackSettings>, message: string) {
    setSaving(true);
    try {
      queryClient.setQueryData(["feedback-settings"], await action());
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      notifySaved(message);
      setConfirmReset(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  const saveButton = dirty ? (
    <Button
      leftSection={<IconDeviceFloppy size={18} />}
      onClick={() => run(() => api.saveFeedbackSettings(form), "Đã lưu cài đặt góp ý")}
      loading={saving}
      miw={140}
      flex={desktop ? undefined : 1}
    >
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
      <Anchor component={Link} to="/feedback" fz="sm" c="dimmed">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Danh sách góp ý
        </Group>
      </Anchor>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Cài đặt góp ý</Title>
          <Text c="dimmed" fz="sm">
            {query.data.updatedAt ? `Sửa lần cuối ${fullTime(query.data.updatedAt)}.` : "Đang dùng cài đặt mặc định."}
          </Text>
        </div>
        {desktop ? <Group gap="sm">{actions}</Group> : null}
      </Group>

      <Paper p="md" radius="lg" shadow="xs">
        <Stack gap="sm">
          <TagsInput
            label="Email nhận thông báo"
            description={`Mỗi góp ý mới hoặc tin nhắn thêm của người dùng được gửi về các địa chỉ này (tối đa ${MAX_RECIPIENTS}). Gõ email rồi bấm Enter.`}
            placeholder={form.recipients.length ? "" : "Chưa có email nào — chỉ xem được trên trang này"}
            value={form.recipients}
            onChange={(v) => setForm({ ...form, recipients: v })}
            maxTags={MAX_RECIPIENTS}
            splitChars={[",", " ", ";"]}
            clearable
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="Góp ý mới tối đa mỗi ngày (một người)"
              description="Chống gửi tràn lan. Trả lời trong góp ý cũ không tính."
              min={1}
              max={50}
              value={form.dailyLimit}
              onChange={(v) => setForm({ ...form, dailyLimit: typeof v === "number" ? v : form.dailyLimit })}
            />
            <NumberInput
              label="Tự đóng sau (ngày)"
              description="Góp ý đã trả lời mà người dùng không phản hồi thêm sẽ tự đóng."
              min={1}
              max={365}
              value={form.autoCloseDays}
              onChange={(v) => setForm({ ...form, autoCloseDays: typeof v === "number" ? v : form.autoCloseDays })}
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      <div>
        <Title order={4}>Câu trả lời mẫu</Title>
        <Text c="dimmed" fz="sm">
          Chọn nhanh khi trả lời góp ý, sửa lại trước khi gửi nếu cần.
        </Text>
      </div>

      {form.replies.map((r, i) => (
        <Paper key={i} p="md" radius="lg" shadow="xs">
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput
                flex={1}
                label={`Mẫu ${i + 1}`}
                placeholder="Tên ngắn, ví dụ: Đã sửa"
                maxLength={60}
                value={r.title}
                onChange={(e) => setReply(i, { ...r, title: e.currentTarget.value })}
              />
              <Order
                index={i}
                count={form.replies.length}
                onMove={(to) => setForm({ ...form, replies: move(form.replies, i, to) })}
                onDelete={() => setForm({ ...form, replies: form.replies.filter((_, j) => j !== i) })}
                label="mẫu"
              />
            </Group>
            <Textarea
              autosize
              minRows={2}
              maxLength={2000}
              placeholder="Nội dung trả lời"
              value={r.body}
              onChange={(e) => setReply(i, { ...r, body: e.currentTarget.value })}
            />
          </Stack>
        </Paper>
      ))}

      <Button
        variant="default"
        leftSection={<IconPlus size={18} />}
        onClick={() => setForm({ ...form, replies: [...form.replies, { title: "", body: "" }] })}
        disabled={form.replies.length >= MAX_REPLIES}
        style={{ alignSelf: "flex-start" }}
      >
        Thêm câu trả lời mẫu
      </Button>

      {!desktop ? (
        <Paper shadow="md" p="sm" style={mobileActionBarStyle}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      <Modal opened={confirmReset} onClose={() => setConfirmReset(false)} title="Khôi phục cài đặt mặc định?" centered>
        <Stack>
          <Text fz="sm">Email nhận và câu trả lời mẫu trở về bản mặc định. Bản hiện tại vẫn nằm trong lịch sử nên có thể quay lại.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmReset(false)}>
              Huỷ
            </Button>
            <Button leftSection={<IconRestore size={18} />} loading={saving} onClick={() => run(api.resetFeedbackSettings, "Đã khôi phục mặc định")}>
              Khôi phục
            </Button>
          </Group>
        </Stack>
      </Modal>
      <HistoryDrawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="settings"
        entityId="feedback"
        title="Cài đặt góp ý"
        onRestored={() => setHistoryOpen(false)}
      />
    </Stack>
  );
}
