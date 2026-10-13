import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconBell, IconClock, IconInfoCircle, IconSend, IconX } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastContent,
  type BroadcastScreen,
  type PushResult,
} from "../api";
import { fullTime, notifyError, notifySaved } from "../lib";
import { Banner } from "./NotificationsPage";

/** Limits mirror BroadcastRules on the server. */
const MAX_TITLE = 90;
const MAX_BODY = 180;

const SCREENS: { value: BroadcastScreen; label: string }[] = [
  { value: "", label: "Mở app (màn đang dở)" },
  { value: "study", label: "Học từ mới" },
  { value: "practice", label: "Ôn tập" },
  { value: "listen", label: "Nghe" },
  { value: "invite", label: "Mời bạn bè" },
];

const AUDIENCES: { value: BroadcastAudience; label: string; hint: string }[] = [
  { value: "all", label: "Tất cả", hint: "Mọi tài khoản đang hoạt động." },
  { value: "active", label: "Học trong 7 ngày", hint: "Có học ít nhất một ngày trong 7 ngày qua." },
  { value: "inactive", label: "Lâu không học", hint: "Không học 14 ngày trở lên, hoặc chưa học lần nào." },
  { value: "premium", label: "Premium", hint: "Đang có Premium, kể cả học viên trung tâm." },
  { value: "partner", label: "Học viên trung tâm", hint: "Học viên đang dùng mã của một trung tâm." },
];

const STATUS: Record<Broadcast["status"], { label: string; color: string }> = {
  scheduled: { label: "Hẹn giờ", color: "blue" },
  sending: { label: "Đang gửi", color: "orange" },
  done: { label: "Đã xong", color: "teal" },
  cancelled: { label: "Đã huỷ", color: "gray" },
};

const audienceLabel = (b: Pick<Broadcast, "audience" | "partnerName">) =>
  b.audience === "partner" ? `Học viên ${b.partnerName ?? "trung tâm"}` : (AUDIENCES.find((a) => a.value === b.audience)?.label ?? b.audience);

/** "yyyy-MM-ddTHH:mm" in local time, the format of <input type="datetime-local">. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BroadcastsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [screen, setScreen] = useState<BroadcastScreen>("");
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState(() => localInput(new Date(Date.now() + 60 * 60_000)));
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ key: string; result: PushResult } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState<Broadcast | null>(null);

  const content: BroadcastContent = { title: title.trim(), body: body.trim(), screen };
  const contentKey = JSON.stringify(content);
  const tested = test?.key === contentKey;
  const audienceReady = audience !== "partner" || !!partnerId;
  const scheduledAt = when === "later" ? new Date(at) : null;
  const timeError =
    scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) ? "Chọn một thời điểm trong tương lai" : null;
  const canSend = !!content.title && !!content.body && audienceReady && !timeError;

  const partners = useQuery({ queryKey: ["partners"], queryFn: api.partners, enabled: audience === "partner" });
  const estimate = useQuery({
    queryKey: ["broadcast-estimate", audience, partnerId],
    queryFn: () => api.estimateBroadcast(audience, audience === "partner" ? partnerId : null),
    enabled: audienceReady,
  });
  const history = useQuery({
    queryKey: ["broadcasts"],
    queryFn: api.broadcasts,
    refetchInterval: (q) => (q.state.data?.some((b) => b.status === "scheduled" || b.status === "sending") ? 15_000 : false),
  });

  async function sendTest() {
    setTesting(true);
    try {
      setTest({ key: contentKey, result: await api.testBroadcast(content) });
    } catch (e) {
      notifyError(e);
    } finally {
      setTesting(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      await api.createBroadcast({
        ...content,
        audience,
        partnerId: audience === "partner" ? partnerId : null,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      });
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      notifySaved(scheduledAt ? "Đã hẹn giờ gửi" : "Đã bắt đầu gửi");
      setConfirming(false);
      setTitle("");
      setBody("");
      setScreen("");
      setTest(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setSending(false);
    }
  }

  async function cancel(b: Broadcast) {
    try {
      await api.cancelBroadcast(b.id);
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      notifySaved("Đã huỷ");
      setCancelling(null);
    } catch (e) {
      notifyError(e);
    }
  }

  const reach = estimate.data?.reachable ?? 0;

  return (
    <Stack gap="md" maw={1100}>
      <div>
        <Title order={2}>Gửi thông báo</Title>
        <Text c="dimmed" fz="sm">
          Gửi tin mới tới điện thoại người học: bài học mới, tính năng mới, lời nhắn từ 4UME.
        </Text>
      </div>

      <Alert variant="light" icon={<IconInfoCircle size={18} />}>
        Chỉ gửi tới người đang bật <b>Tin mới từ 4UME</b> trong Cài đặt app và đã cho phép thông báo. Người đang trong giờ yên tĩnh (giờ của
        họ) sẽ nhận khi hết giờ yên tĩnh; sau 24 giờ chưa gửi được thì bỏ qua. Nên gửi ít, nội dung có ích: gửi nhiều người dùng sẽ tắt thông
        báo. Tin khuyến mãi chỉ gửi khi đã có đồng ý rõ ràng (quy định của Apple). Nội dung nhắc học tự động sửa ở{" "}
        <Anchor component={Link} to="/notifications" fz="sm">
          Thông báo
        </Anchor>
        .
      </Alert>

      <Paper p="md" radius="lg" shadow="xs">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="md">
            <TextInput
              label="Tiêu đề"
              maxLength={MAX_TITLE}
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              description={`${title.length}/${MAX_TITLE} ký tự`}
              placeholder="Có 5 bài nghe mới cho bạn"
            />
            <Textarea
              label="Nội dung"
              autosize
              minRows={2}
              maxLength={MAX_BODY}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
              description={`${body.length}/${MAX_BODY} ký tự`}
              placeholder="Chủ đề du lịch và công việc, trình độ A2–B1. Nghe thử 5 phút nhé!"
            />
            <Select
              label="Khi chạm vào thông báo"
              data={SCREENS}
              value={screen}
              onChange={(v) => setScreen((v ?? "") as BroadcastScreen)}
              allowDeselect={false}
              description="App cũ chưa có màn này thì chỉ mở app."
            />

            <Select
              label="Người nhận"
              data={AUDIENCES.map((a) => ({ value: a.value, label: a.label }))}
              value={audience}
              onChange={(v) => setAudience((v ?? "all") as BroadcastAudience)}
              allowDeselect={false}
              description={AUDIENCES.find((a) => a.value === audience)?.hint}
            />
            {audience === "partner" ? (
              <Select
                label="Trung tâm"
                placeholder={partners.isLoading ? "Đang tải…" : "Chọn trung tâm"}
                data={(partners.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                value={partnerId}
                onChange={setPartnerId}
                searchable
              />
            ) : null}
            <EstimateLine loading={estimate.isFetching} data={estimate.data} ready={audienceReady} error={estimate.error as Error | null} />

            <div>
              <Text fz="sm" fw={500} mb={4}>
                Thời điểm
              </Text>
              <SegmentedControl
                data={[
                  { value: "now", label: "Gửi ngay" },
                  { value: "later", label: "Hẹn giờ" },
                ]}
                value={when}
                onChange={(v) => setWhen(v as "now" | "later")}
              />
            </div>
            {when === "later" ? (
              <TextInput
                type="datetime-local"
                label="Gửi lúc (giờ máy bạn)"
                value={at}
                onChange={(e) => setAt(e.currentTarget.value)}
                error={timeError}
                description="Máy chủ kiểm tra 5 phút một lần nên có thể trễ vài phút."
                maw={260}
              />
            ) : null}
          </Stack>

          <Box>
            <Stack gap="sm" style={{ position: "sticky", top: 80 }}>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">
                Xem trước
              </Text>
              <Banner caption="Trên màn hình khoá" title={content.title || "Tiêu đề thông báo"} body={content.body || "Nội dung thông báo"} />

              <Group gap="sm" mt="sm">
                <Button variant="light" leftSection={<IconBell size={18} />} loading={testing} disabled={!content.title || !content.body} onClick={sendTest}>
                  Gửi thử cho tôi
                </Button>
                <Button
                  leftSection={when === "later" ? <IconClock size={18} /> : <IconSend size={18} />}
                  disabled={!canSend || !tested}
                  onClick={() => setConfirming(true)}
                >
                  {when === "later" ? "Hẹn giờ gửi…" : "Gửi…"}
                </Button>
              </Group>
              {test && tested ? (
                <Text fz="sm" c={test.result.sent > 0 ? "teal.7" : "red.7"}>
                  {test.result.sent > 0
                    ? `Đã gửi thử tới ${test.result.sent}/${test.result.devices} máy của bạn. Kiểm tra điện thoại rồi bấm Gửi.`
                    : test.result.devices === 0
                      ? "Tài khoản admin này chưa có điện thoại nhận thông báo. Đăng nhập app bằng tài khoản này và cho phép thông báo để xem thử."
                      : `Chưa gửi thử được (${test.result.errors.join(", ")}).`}
                </Text>
              ) : (
                <Text fz="xs" c="dimmed">
                  Gửi thử tới điện thoại của chính bạn trước, rồi mới gửi thật được. Sửa nội dung thì phải gửi thử lại.
                </Text>
              )}
            </Stack>
          </Box>
        </SimpleGrid>
      </Paper>

      <Title order={4} mt="md">
        Đã gửi
      </Title>
      {history.error ? <Alert color="red">{(history.error as Error).message}</Alert> : null}
      {history.isLoading ? <Skeleton h={100} radius="lg" /> : null}
      {history.data?.length === 0 ? (
        <Text c="dimmed" fz="sm">
          Chưa gửi thông báo nào.
        </Text>
      ) : null}
      <Stack gap="sm">
        {history.data?.map((b) => (
          <HistoryCard key={b.id} b={b} onCancel={() => setCancelling(b)} />
        ))}
      </Stack>

      <Modal opened={confirming} onClose={() => setConfirming(false)} title={when === "later" ? "Hẹn giờ gửi thông báo?" : "Gửi thông báo?"} centered>
        <Stack>
          <Banner caption={audienceLabel({ audience, partnerName: partners.data?.find((p) => p.id === partnerId)?.name ?? null })} title={content.title} body={content.body} />
          <Text fz="sm">
            {scheduledAt ? `Gửi lúc ${fullTime(scheduledAt.toISOString())} ` : "Gửi ngay "}
            tới khoảng <b>{reach.toLocaleString("vi-VN")} người</b>
            {scheduledAt ? " (tính lại lúc gửi)" : ""}. Đã gửi thì không thu hồi được.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirming(false)}>
              Huỷ
            </Button>
            <Button leftSection={<IconSend size={18} />} loading={sending} onClick={send}>
              {scheduledAt ? "Hẹn giờ" : `Gửi tới ${reach.toLocaleString("vi-VN")} người`}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!cancelling} onClose={() => setCancelling(null)} title="Huỷ đợt gửi này?" centered>
        <Stack>
          <Text fz="sm">
            {cancelling?.status === "scheduled"
              ? "Thông báo sẽ không được gửi."
              : "Những người chưa nhận (đang chờ hết giờ yên tĩnh) sẽ không nhận nữa. Người đã nhận thì vẫn giữ."}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCancelling(null)}>
              Không
            </Button>
            <Button color="red" leftSection={<IconX size={18} />} onClick={() => cancelling && cancel(cancelling)}>
              Huỷ đợt gửi
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function EstimateLine({
  loading,
  data,
  ready,
  error,
}: {
  loading: boolean;
  data: { matching: number; reachable: number; optedOut: number; noDevice: number } | undefined;
  ready: boolean;
  error: Error | null;
}) {
  if (!ready) return null;
  if (error) return <Text fz="sm" c="red.7">{error.message}</Text>;
  if (!data) return <Skeleton h={20} w={260} />;
  const n = (v: number) => v.toLocaleString("vi-VN");
  return (
    <Text fz="sm" c={loading ? "dimmed" : undefined}>
      Sẽ nhận: <b>{n(data.reachable)}</b> / {n(data.matching)} người
      <Text span fz="xs" c="dimmed">
        {" "}
        · {n(data.optedOut)} tắt tin mới · {n(data.noDevice)} chưa bật thông báo
      </Text>
    </Text>
  );
}

function HistoryCard({ b, onCancel }: { b: Broadcast; onCancel: () => void }) {
  const status = STATUS[b.status];
  const open = b.status === "scheduled" || b.status === "sending";
  const parts = [
    b.status === "scheduled" ? null : `đã gửi ${b.sent}/${b.recipients}`,
    b.pending ? `${b.pending} chờ hết giờ yên tĩnh` : null,
    b.failed ? `${b.failed} lỗi` : null,
    b.skipped ? `${b.skipped} bỏ qua` : null,
  ].filter(Boolean);
  return (
    <Card p="md" radius="lg" shadow="xs">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box miw={0}>
          <Group gap="xs" mb={4}>
            <Badge color={status.color} variant="light">
              {status.label}
            </Badge>
            <Badge color="gray" variant="outline">
              {audienceLabel(b)}
            </Badge>
            {b.screen ? (
              <Badge color="gray" variant="transparent">
                mở: {SCREENS.find((s) => s.value === b.screen)?.label ?? b.screen}
              </Badge>
            ) : null}
          </Group>
          <Text fw={700}>{b.title}</Text>
          <Text fz="sm" c="dimmed" lineClamp={2}>
            {b.body}
          </Text>
          <Text fz="xs" c="dimmed" mt={6}>
            {b.status === "scheduled" ? `Hẹn ${fullTime(b.scheduledAt)}` : `Gửi ${fullTime(b.scheduledAt)}`} · {b.createdBy}
            {parts.length ? ` · ${parts.join(" · ")}` : ""}
          </Text>
          {b.lastError ? (
            <Text fz="xs" c="red.7">
              Lỗi gần nhất: {b.lastError}
            </Text>
          ) : null}
        </Box>
        {open ? (
          <Button variant="subtle" color="red" size="compact-sm" onClick={onCancel}>
            Huỷ
          </Button>
        ) : null}
      </Group>
    </Card>
  );
}
