import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Grid,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconBrandAndroid,
  IconBrandApple,
  IconHistory,
  IconLock,
  IconLockOpen,
  IconShieldCheck,
  IconShieldLock,
  IconShieldOff,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AdminUserDetail } from "../api";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { fullTime, notifyError, notifySaved, shortDate, studyAgo, timeAgo } from "../lib";
import { ActivityCalendar } from "../users/ActivityCalendar";
import { UserAvatar, UserBadges } from "../users/UserBadges";

type Change = "grant" | "revoke" | "lock" | "unlock";

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["user", id], queryFn: () => api.user(id!) });
  const [change, setChange] = useState<Change | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/users"));

  if (detail.error) {
    return (
      <Stack maw={900}>
        <Button variant="subtle" leftSection={<IconArrowLeft size={18} />} onClick={() => navigate("/users")} w="fit-content">
          Người dùng
        </Button>
        <Alert color="red">{(detail.error as Error).message}</Alert>
      </Stack>
    );
  }
  if (!detail.data) {
    return (
      <Stack maw={1100}>
        <Skeleton h={120} radius="lg" />
        <Skeleton h={200} radius="lg" />
      </Stack>
    );
  }

  const d = detail.data;
  const u = d.user;
  const isAdmin = u.role === "admin";
  const locked = !!u.lockedAt;

  function applied(next: AdminUserDetail) {
    queryClient.setQueryData(["user", id], next);
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  }

  const actions = d.isSelf || d.isProtected ? null : (
    <>
      {!locked ? (
        isAdmin ? (
          <Button variant="default" leftSection={<IconShieldOff size={18} />} onClick={() => setChange("revoke")}>
            {desktop ? "Thu quyền quản trị" : "Thu quyền"}
          </Button>
        ) : (
          <Button variant="default" leftSection={<IconShieldCheck size={18} />} onClick={() => setChange("grant")}>
            {desktop ? "Cấp quyền quản trị" : "Cấp quyền"}
          </Button>
        )
      ) : null}
      {locked ? (
        <Button variant="light" leftSection={<IconLockOpen size={18} />} onClick={() => setChange("unlock")}>
          Mở khoá
        </Button>
      ) : (
        <Button variant="light" color="red" leftSection={<IconLock size={18} />} onClick={() => setChange("lock")}>
          {desktop ? "Khoá tài khoản" : "Khoá"}
        </Button>
      )}
    </>
  );

  return (
    <Stack gap="md" maw={1100}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon variant="subtle" size="lg" onClick={back} aria-label="Quay lại">
            <IconArrowLeft />
          </ActionIcon>
          <UserAvatar user={u} size={desktop ? 56 : 44} />
          <div style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Title order={2} lineClamp={1}>
                {u.displayName}
              </Title>
              <UserBadges user={u} />
            </Group>
            <Text fz="sm" c="dimmed" truncate>
              {u.email}
            </Text>
          </div>
        </Group>
        <Group gap="sm" wrap="nowrap">
          {desktop ? (
            <>
              <Button variant="default" leftSection={<IconHistory size={18} />} onClick={() => setHistoryOpen(true)}>
                Lịch sử
              </Button>
              {actions}
            </>
          ) : (
            <ActionIcon variant="default" size={42} radius="md" onClick={() => setHistoryOpen(true)} aria-label="Lịch sử">
              <IconHistory size={20} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {!desktop && actions ? (
        <SimpleGrid cols={locked ? 1 : 2} spacing="sm">
          {actions}
        </SimpleGrid>
      ) : null}

      {d.isProtected ? (
        <Alert color="brand" variant="light" icon={<IconShieldLock size={18} />}>
          Đây là tài khoản quản trị gốc: luôn giữ quyền quản trị, không thể bị khoá, thu quyền hay xoá.
        </Alert>
      ) : d.isSelf ? (
        <Alert color="blue" variant="light">
          Đây là tài khoản của bạn. Bạn không thể tự thu quyền hay tự khoá mình; nếu cần, nhờ một quản trị viên khác.
        </Alert>
      ) : null}
      {locked ? (
        <Alert color="red" variant="light" icon={<IconLock size={18} />}>
          Tài khoản bị khoá lúc {fullTime(u.lockedAt!)}: không đăng nhập được app, phiên đang mở cũng bị đăng xuất. Tiến độ học vẫn được giữ.
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        <Stat label="Chuỗi hiện tại" value={`${u.currentStreak} ngày`} accent={u.currentStreak > 0} />
        <Stat label="Chuỗi dài nhất" value={`${d.bestStreak} ngày`} />
        <Stat label="Ngày đã học" value={d.totalStudyDays.toLocaleString("vi-VN")} hint={`Học gần nhất: ${studyAgo(u.lastStudyDate)}`} />
        <Stat label="Từ đã thuộc" value={u.knownWords.toLocaleString("vi-VN")} hint={`${d.hardWords} từ khó`} />
        <Stat label="Ngữ pháp" value={`${u.grammarPassed}/${d.grammarTotal}`} hint="bài đã qua" />
        <Stat label="Lượt đóng băng" value={String(d.streakFreezes)} hint="giữ chuỗi khi lỡ ngày" />
      </SimpleGrid>

      <Grid gap="md" align="stretch">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card title="Hoạt động 12 tuần">
            <ActivityCalendar days={d.days} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card title="Cài đặt học trên app">
            <Stack gap={8}>
              <Row label="Mục tiêu" value={`${d.settings.dailyGoal} từ mới / ngày`} />
              <Row label="Nhắc học hằng ngày" value={d.settings.reminderEnabled ? `Bật, lúc ${d.settings.reminderTime}` : "Tắt"} />
              <Row label="Nhắc cứu chuỗi" value={<OnOff on={d.settings.notifyRescue} />} />
              <Row label="Tổng kết tuần" value={<OnOff on={d.settings.notifyWeekly} />} />
              <Row label="Tin mới" value={<OnOff on={d.settings.notifyNews} />} />
              <Row label="Múi giờ" value={d.settings.timeZone ?? "—"} />
              <Row label="Tham gia" value={shortDate(u.createdAt)} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card title="Thiết bị nhận thông báo">
        {d.devices.length === 0 ? (
          <Text fz="sm" c="dimmed">
            Chưa có thiết bị nào đăng ký. Danh sách này sẽ có dữ liệu khi app bật thông báo đẩy (giai đoạn thông báo 2).
          </Text>
        ) : (
          <Stack gap="xs">
            {d.devices.map((dev, i) => (
              <Group key={i} gap="sm" wrap="nowrap">
                {dev.platform === "ios" ? <IconBrandApple size={20} /> : <IconBrandAndroid size={20} />}
                <Text fz="sm" style={{ flex: 1 }}>
                  {dev.platform === "ios" ? "iPhone / iPad" : "Android"}
                  {dev.appVersion ? ` · bản ${dev.appVersion}` : ""}
                </Text>
                <Text fz="xs" c="dimmed">
                  dùng {timeAgo(dev.lastSeenAt)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <ChangeModal change={change} detail={d} onClose={() => setChange(null)} onDone={applied} />
      <HistoryDrawer opened={historyOpen} onClose={() => setHistoryOpen(false)} entityType="user" entityId={u.id} title={u.displayName} />
    </Stack>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper p="md" radius="lg" shadow="xs" h="100%">
      <Text fw={700} fz="sm" tt="uppercase" c="dimmed" mb="sm">
        {title}
      </Text>
      {children}
    </Paper>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Text fz={24} fw={700} c={accent ? "orange.7" : "brand.7"} lh={1.1}>
        {value}
      </Text>
      <Text fz="sm" mt={4}>
        {label}
      </Text>
      {hint ? (
        <Text fz="xs" c="dimmed">
          {hint}
        </Text>
      ) : null}
    </Paper>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap">
      <Text fz="sm" c="dimmed">
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text fz="sm" fw={500} ta="right">
          {value}
        </Text>
      ) : (
        value
      )}
    </Group>
  );
}

function OnOff({ on }: { on: boolean }) {
  return (
    <Badge color={on ? "green" : "gray"} variant="light" size="sm">
      {on ? "Bật" : "Tắt"}
    </Badge>
  );
}

const COPY: Record<Change, { title: string; confirm: string; color?: string }> = {
  grant: { title: "Cấp quyền quản trị?", confirm: "Cấp quyền" },
  revoke: { title: "Thu quyền quản trị?", confirm: "Thu quyền" },
  lock: { title: "Khoá tài khoản?", confirm: "Khoá tài khoản", color: "red" },
  unlock: { title: "Mở khoá tài khoản?", confirm: "Mở khoá" },
};

/** Confirms a role / lock change; granting admin also asks to type the email, since it opens the whole admin. */
function ChangeModal({
  change,
  detail,
  onClose,
  onDone,
}: {
  change: Change | null;
  detail: AdminUserDetail;
  onClose: () => void;
  onDone: (d: AdminUserDetail) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const u = detail.user;
  const copy = change ? COPY[change] : null;
  const needsEmail = change === "grant";
  const ready = !needsEmail || typed.trim().toLowerCase() === u.email.toLowerCase();

  function close() {
    setTyped("");
    onClose();
  }

  async function run() {
    if (!change) return;
    setBusy(true);
    try {
      const next =
        change === "grant" || change === "revoke"
          ? await api.setUserRole(u.id, change === "grant" ? "admin" : "user")
          : await api.setUserLocked(u.id, change === "lock");
      onDone(next);
      notifySaved(
        { grant: "Đã cấp quyền quản trị", revoke: "Đã thu quyền quản trị", lock: "Đã khoá tài khoản", unlock: "Đã mở khoá tài khoản" }[change],
      );
      close();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={!!change} onClose={close} title={copy?.title} centered>
      <Stack>
        {change === "grant" ? (
          <>
            <Text fz="sm">
              <b>{u.displayName}</b> sẽ đăng nhập được web admin và sửa được toàn bộ nội dung, người dùng và cài đặt hệ thống. Chỉ cấp cho người
              bạn tin tưởng.
            </Text>
            <TextInput
              label={`Gõ lại email ${u.email} để xác nhận`}
              value={typed}
              onChange={(e) => setTyped(e.currentTarget.value)}
              autoComplete="off"
              data-autofocus
            />
          </>
        ) : null}
        {change === "revoke" ? (
          <Text fz="sm">
            <b>{u.displayName}</b> sẽ không vào được web admin nữa. Tài khoản học trên app vẫn dùng bình thường.
          </Text>
        ) : null}
        {change === "lock" ? (
          <Text fz="sm">
            <b>{u.displayName}</b> sẽ bị đăng xuất khỏi app và không đăng nhập lại được. Tiến độ học vẫn được giữ, mở khoá là dùng lại được.
            {u.role === "admin" ? " Quyền quản trị cũng bị thu và không tự trả lại khi mở khoá." : ""}
          </Text>
        ) : null}
        {change === "unlock" ? (
          <Text fz="sm">
            <b>{u.displayName}</b> sẽ đăng nhập lại được app như trước.
          </Text>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Huỷ
          </Button>
          <Button color={copy?.color} disabled={!ready} loading={busy} onClick={run}>
            {copy?.confirm}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
