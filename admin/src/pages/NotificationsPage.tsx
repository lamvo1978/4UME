import { ActionIcon, Alert, Anchor, Box, Button, Code, Group, Modal, Paper, SimpleGrid, Skeleton, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconCheck, IconDeviceFloppy, IconHistory, IconInfoCircle, IconPlus, IconRefresh, IconRestore, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminNotificationTexts, type NotificationTexts } from "../api";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { mobileActionBarStyle } from "../layout/mobileActionBar";
import { fullTime, notifyError, notifySaved } from "../lib";

/** Limits mirror NotificationTextRules on the server. */
const MAX_VARIANTS = 8;
const MAX_TITLE = 90;
const MAX_BODY = 180;

const VAR_HINTS: Record<string, string> = {
  what: "số từ/bài cần ôn, ví dụ “12 từ và 2 bài ngữ pháp”",
  count: "số từ",
  words: "số từ mới",
  reviews: "số lượt ôn",
  subject: "tiêu đề góp ý",
  reply: "đầu câu trả lời của admin",
  streak: "số ngày của chuỗi",
  milestone: "mốc chuỗi sắp đạt (7, 14, 30…)",
  days: "số ngày",
  left: "thời gian còn lại, ví dụ “3 tiếng”",
  time: "giờ nhắc của người dùng, ví dụ 20:00",
};

type Key = keyof NotificationTexts;
type Field = { key: Key; label: string; vars: string[]; max: number };

const SAMPLE = { what: "12 từ và 2 bài ngữ pháp", count: 10, streak: 12, milestone: 14, left: "3 tiếng", time: "20:00" };
const WEEKLY_SAMPLE = { days: 5, words: 42, reviews: 120 };
const FEEDBACK_SAMPLE = {
  subject: "Lỗi phát âm từ schedule",
  reply: "Cảm ơn bạn đã báo lỗi! Mình đã sửa phát âm của từ này, bạn cập nhật lại app là thấy nhé.",
};

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

function pick(items: string[], seed: number) {
  return items.length ? items[seed % items.length] : "";
}

function unknownVars(text: string, vars: string[]) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => !vars.includes(v));
}

export function NotificationsPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["notification-texts"], queryFn: api.notificationTexts });
  const stored = query.data?.value ?? null;
  const [form, setForm] = useState<NotificationTexts | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [seed, setSeed] = useState(0);

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
      <Stack maw={1100}>
        <Skeleton h={60} radius="lg" />
        <Skeleton h={300} radius="lg" />
      </Stack>
    );
  }

  const t = form;
  const set = (key: Key, value: string | string[]) => setForm({ ...form, [key]: value });

  async function run(action: () => Promise<AdminNotificationTexts>, message: string) {
    setSaving(true);
    try {
      queryClient.setQueryData(["notification-texts"], await action());
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
      onClick={() => run(() => api.saveNotificationTexts(form), "Đã lưu nội dung thông báo")}
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

  const editor = (f: Field) => <TextsField key={f.key} field={f} value={t[f.key]} onChange={(v) => set(f.key, v)} />;
  const nextSample = (
    <Button variant="subtle" size="compact-sm" leftSection={<IconRefresh size={14} />} onClick={() => setSeed(seed + 1)}>
      Xem câu khác
    </Button>
  );
  const streakBody = fill(pick(t.streakLines, seed), SAMPLE);

  return (
    <Stack gap="md" maw={1100} pb={desktop ? 0 : 80}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Thông báo</Title>
          <Text c="dimmed" fz="sm">
            {query.data.updatedAt ? `Sửa lần cuối ${fullTime(query.data.updatedAt)}.` : "Đang dùng nội dung mặc định."}
          </Text>
        </div>
        {desktop ? <Group gap="sm">{actions}</Group> : null}
      </Group>

      <Alert variant="light" icon={<IconInfoCircle size={18} />}>
        Nhắc học, cứu chuỗi và quay lại học do app tự đặt lịch ngay trên điện thoại; tổng kết tuần, trả lời góp ý và quay lại học sau thời
        gian dài do máy chủ gửi. Mỗi ngày dùng lần lượt một câu trong danh sách để không lặp lại. Chữ trong
        ngoặc nhọn như <Code>{"{streak}"}</Code> được app thay bằng số thật. Sửa xong, app nhận nội dung mới khi mở lại. Giờ gửi, giờ yên tĩnh
        và số thông báo mỗi ngày nằm ở{" "}
        <Anchor component={Link} to="/settings" fz="sm">
          Cài đặt
        </Anchor>
        .
      </Alert>

      <Section
        title="Nhắc học hằng ngày"
        description="Gửi vào giờ nhắc người dùng chọn. Tiêu đề tuỳ việc hôm nay: có bài cần ôn, còn từ mới, hay đã học đủ. Dòng dưới nói về chuỗi ngày học."
        fields={
          <>
            {editor({ key: "dueTitles", label: "Tiêu đề · có bài cần ôn", vars: ["what"], max: MAX_TITLE })}
            {editor({ key: "newWordsTitles", label: "Tiêu đề · còn từ mới để học", vars: ["count"], max: MAX_TITLE })}
            {editor({ key: "encouragementTitles", label: "Tiêu đề · đã học đủ mục tiêu", vars: [], max: MAX_TITLE })}
            {editor({ key: "streakLines", label: "Dòng dưới · đang có chuỗi", vars: ["streak"], max: MAX_BODY })}
            {editor({ key: "startStreakLines", label: "Dòng dưới · chưa có chuỗi", vars: [], max: MAX_BODY })}
            {editor({ key: "milestoneTomorrow", label: "Dòng dưới · học hôm nay là đạt mốc", vars: ["milestone"], max: MAX_BODY })}
            {editor({ key: "milestoneSoon", label: "Dòng dưới · còn 2 ngày nữa đạt mốc", vars: ["days", "milestone"], max: MAX_BODY })}
          </>
        }
        preview={
          <>
            <Banner caption="Có 12 từ và 2 bài ngữ pháp cần ôn, chuỗi 12 ngày" title={fill(pick(t.dueTitles, seed), SAMPLE)} body={streakBody} />
            <Banner
              caption="Còn 10 từ mới, chuỗi 13 ngày (mai đạt mốc 14)"
              title={fill(pick(t.newWordsTitles, seed), SAMPLE)}
              body={fill(t.milestoneTomorrow, SAMPLE)}
            />
            <Banner
              caption="Đã học đủ, chuỗi 12 ngày (còn 2 ngày đạt mốc 14)"
              title={pick(t.encouragementTitles, seed)}
              body={fill(t.milestoneSoon, { ...SAMPLE, days: 2 })}
            />
            <Banner caption="Chưa có chuỗi" title={pick(t.encouragementTitles, seed + 1)} body={pick(t.startStreakLines, seed)} />
            {nextSample}
          </>
        }
      />

      <Section
        title="Cứu chuỗi"
        description="Gửi buổi tối khi hôm nay chưa học và chuỗi sắp mất. Nếu người dùng còn lượt đóng băng thì dùng bộ câu nhẹ nhàng hơn."
        fields={
          <>
            {editor({ key: "rescueTitles", label: "Tiêu đề · hết lượt đóng băng", vars: ["streak", "left"], max: MAX_TITLE })}
            {editor({ key: "rescueBodies", label: "Nội dung · hết lượt đóng băng", vars: ["streak"], max: MAX_BODY })}
            {editor({ key: "rescueFreezeTitle", label: "Tiêu đề · còn lượt đóng băng", vars: ["streak"], max: MAX_TITLE })}
            {editor({ key: "rescueFreezeBodies", label: "Nội dung · còn lượt đóng băng", vars: ["streak"], max: MAX_BODY })}
          </>
        }
        preview={
          <>
            <Banner caption="Chuỗi 12 ngày, hết lượt đóng băng, còn 3 tiếng" title={fill(pick(t.rescueTitles, seed), SAMPLE)} body={fill(pick(t.rescueBodies, seed), SAMPLE)} />
            <Banner caption="Chuỗi 12 ngày, còn lượt đóng băng" title={fill(t.rescueFreezeTitle, SAMPLE)} body={fill(pick(t.rescueFreezeBodies, seed), SAMPLE)} />
            {nextSample}
          </>
        }
      />

      <Section
        title="Quay lại học"
        description="Gửi vào giờ nhắc học khi người dùng đã nghỉ vài ngày (số ngày chọn ở Cài đặt): máy tự gửi ở các mốc “trên máy”, máy chủ gửi các mốc xa hơn như 14, 30 ngày. Có từ cần ôn thì gợi ý ôn tối đa 5 từ."
        fields={
          <>
            {editor({ key: "comebackTitles", label: "Tiêu đề", vars: ["days"], max: MAX_TITLE })}
            {editor({ key: "comebackDueBody", label: "Nội dung · có từ cần ôn", vars: ["days", "count"], max: MAX_BODY })}
            {editor({ key: "comebackNewBody", label: "Nội dung · không có từ cần ôn", vars: ["days"], max: MAX_BODY })}
          </>
        }
        preview={
          <>
            <Banner caption="Nghỉ 3 ngày, có 5 từ cần ôn" title={fill(pick(t.comebackTitles, seed), { days: 3 })} body={fill(t.comebackDueBody, { days: 3, count: 5 })} />
            <Banner caption="Nghỉ 7 ngày, không có từ cần ôn" title={fill(pick(t.comebackTitles, seed + 1), { days: 7 })} body={fill(t.comebackNewBody, { days: 7 })} />
            {nextSample}
          </>
        }
      />

      <Section
        title="Tổng kết tuần · từ máy chủ"
        description="Máy chủ gửi vào ngày giờ tổng kết tuần ở Cài đặt, chỉ khi tuần trước có học ít nhất một ngày và người dùng bật Tổng kết tuần. Bấm vào mở màn tổng kết của tuần đó."
        fields={
          <>
            {editor({ key: "weeklyTitle", label: "Tiêu đề", vars: ["days", "words", "reviews"], max: MAX_TITLE })}
            {editor({ key: "weeklyBody", label: "Nội dung", vars: ["days", "words", "reviews"], max: MAX_BODY })}
          </>
        }
        preview={
          <Banner
            caption="Tuần trước học 5 ngày, 42 từ mới, 120 lượt ôn"
            title={fill(t.weeklyTitle, WEEKLY_SAMPLE)}
            body={fill(t.weeklyBody, WEEKLY_SAMPLE)}
          />
        }
      />

      <Section
        title="Trả lời góp ý · từ máy chủ"
        description="Gửi ngay khi admin trả lời một góp ý (trừ giờ yên tĩnh của người dùng). Bấm vào mở đúng góp ý đó."
        fields={
          <>
            {editor({ key: "feedbackReplyTitle", label: "Tiêu đề", vars: ["subject"], max: MAX_TITLE })}
            {editor({ key: "feedbackReplyBody", label: "Nội dung", vars: ["subject", "reply"], max: MAX_BODY })}
          </>
        }
        preview={
          <Banner
            caption="Admin trả lời góp ý “Lỗi phát âm từ schedule”"
            title={fill(t.feedbackReplyTitle, FEEDBACK_SAMPLE)}
            body={fill(t.feedbackReplyBody, FEEDBACK_SAMPLE)}
          />
        }
      />

      <Section
        title="Hỏi bật nhắc học"
        description="Hộp thoại trong app, hiện một lần sau màn chúc mừng chuỗi ngày học đầu tiên, khi người dùng chưa bật nhắc học."
        fields={
          <>
            {editor({ key: "promptTitle", label: "Tiêu đề", vars: ["time"], max: MAX_TITLE })}
            {editor({ key: "promptBody", label: "Nội dung", vars: ["time"], max: MAX_BODY * 2 })}
          </>
        }
        preview={<PromptPreview title={fill(t.promptTitle, SAMPLE)} body={fill(t.promptBody, SAMPLE)} />}
      />

      {!desktop ? (
        <Paper shadow="md" p="sm" style={mobileActionBarStyle}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      <Modal opened={confirmReset} onClose={() => setConfirmReset(false)} title="Khôi phục nội dung mặc định?" centered>
        <Stack>
          <Text fz="sm">Mọi câu thông báo trở về bản mặc định. Bản hiện tại vẫn nằm trong lịch sử nên có thể quay lại.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmReset(false)}>
              Huỷ
            </Button>
            <Button leftSection={<IconRestore size={18} />} loading={saving} onClick={() => run(api.resetNotificationTexts, "Đã khôi phục mặc định")}>
              Khôi phục
            </Button>
          </Group>
        </Stack>
      </Modal>
      <HistoryDrawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="settings"
        entityId="notificationTexts"
        title="Nội dung thông báo"
        onRestored={() => setHistoryOpen(false)}
      />
    </Stack>
  );
}

function Section({ title, description, fields, preview }: { title: string; description: string; fields: React.ReactNode; preview: React.ReactNode }) {
  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Title order={4}>{title}</Title>
      <Text c="dimmed" fz="sm" mb="md">
        {description}
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Stack gap="lg">{fields}</Stack>
        <Box>
          <Stack gap="sm" style={{ position: "sticky", top: 80 }}>
            <Text fz="xs" fw={700} c="dimmed" tt="uppercase">
              Xem trước
            </Text>
            {preview}
          </Stack>
        </Box>
      </SimpleGrid>
    </Paper>
  );
}

function varsHint(vars: string[]) {
  if (!vars.length) return "Không dùng chữ trong ngoặc nhọn.";
  return `Có thể dùng: ${vars.map((v) => `{${v}} = ${VAR_HINTS[v]}`).join("; ")}.`;
}

function TextsField({ field, value, onChange }: { field: Field; value: string | string[]; onChange: (v: string | string[]) => void }) {
  const error = (text: string) => {
    const unknown = unknownVars(text, field.vars);
    if (unknown.length) return `${unknown.map((v) => `{${v}}`).join(", ")} không dùng được ở đây`;
    return text.trim() ? null : "Chưa có nội dung";
  };

  if (!Array.isArray(value)) {
    const long = field.max > MAX_BODY;
    const props = {
      label: field.label,
      description: varsHint(field.vars),
      maxLength: field.max,
      value,
      error: error(value),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.currentTarget.value),
    };
    return long ? <Textarea autosize minRows={2} {...props} /> : <TextInput {...props} />;
  }

  return (
    <Stack gap={6}>
      <div>
        <Text fz="sm" fw={500}>
          {field.label}
        </Text>
        <Text fz="xs" c="dimmed">
          {varsHint(field.vars)} App đổi câu mỗi ngày.
        </Text>
      </div>
      {value.map((v, i) => (
        <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
          <TextInput
            flex={1}
            maxLength={field.max}
            value={v}
            error={error(v)}
            aria-label={`${field.label} câu ${i + 1}`}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? e.currentTarget.value : x)))}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            size={36}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            disabled={value.length <= 1}
            aria-label="Xoá câu"
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        variant="subtle"
        size="compact-sm"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange([...value, ""])}
        disabled={value.length >= MAX_VARIANTS}
        style={{ alignSelf: "flex-start" }}
      >
        Thêm câu
      </Button>
    </Stack>
  );
}

/** Roughly how the reminder looks on a phone's lock screen. */
export function Banner({ caption, title, body }: { caption: string; title: string; body: string }) {
  return (
    <div>
      <Text fz="xs" c="dimmed" mb={4}>
        {caption}
      </Text>
      <Paper p="sm" radius={18} bg="gray.1" withBorder>
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <img
            src="/app-icon.png"
            alt=""
            width={38}
            height={38}
            style={{ borderRadius: 9, flexShrink: 0, border: "1px solid var(--mantine-color-gray-3)" }}
          />
          <Box flex={1} miw={0}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text fz="sm" fw={700} lineClamp={2}>
                {title}
              </Text>
              <Text fz="xs" c="dimmed" style={{ flexShrink: 0 }}>
                bây giờ
              </Text>
            </Group>
            <Text fz="sm" lineClamp={4}>
              {body}
            </Text>
          </Box>
        </Group>
      </Paper>
    </div>
  );
}

function PromptPreview({ title, body }: { title: string; body: string }) {
  return (
    <Paper p="lg" radius={24} withBorder maw={340}>
      <Stack align="center" gap="xs">
        <Text fz={40} lh={1}>
          🔔
        </Text>
        <Text fw={800} fz="lg" ta="center">
          {title}
        </Text>
        <Text fz="sm" c="dimmed" ta="center">
          {body}
        </Text>
        <Button fullWidth color="orange" radius="md" mt="sm" style={{ cursor: "default" }}>
          Bật nhắc học
        </Button>
        <Text fz="sm" c="dimmed" fw={600}>
          Để sau
        </Text>
      </Stack>
    </Paper>
  );
}
