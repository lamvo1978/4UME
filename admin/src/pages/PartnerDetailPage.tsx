import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconCopy,
  IconDownload,
  IconEdit,
  IconHistory,
  IconKey,
  IconSearch,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, featureLabel, type AdminPartnerCode, type AdminPartnerDetail, type SavePartner } from "../api";
import { Select } from "../components/AppSelect";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { notifyError, notifySaved, shortDate } from "../lib";
import { PartnerBillingCard } from "../partners/PartnerBillingCard";
import { PartnerFormModal } from "../partners/PartnerFormModal";
import { endOfVnDay, isExpired, vnDateValue } from "../partners/dates";

type Status = "all" | "unused" | "used" | "expired" | "revoked";
const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unused", label: "Chưa dùng" },
  { value: "used", label: "Đang dùng" },
  { value: "expired", label: "Hết hạn" },
  { value: "revoked", label: "Đã thu hồi" },
];

const codeStatus = (c: AdminPartnerCode): Exclude<Status, "all"> =>
  c.revokedAt ? "revoked" : isExpired(c.expiresAt) ? "expired" : c.usedAt ? "used" : "unused";
const STATUS_BADGE: Record<Exclude<Status, "all">, { label: string; color: string }> = {
  unused: { label: "Chưa dùng", color: "gray" },
  used: { label: "Đang dùng", color: "teal" },
  expired: { label: "Hết hạn", color: "orange" },
  revoked: { label: "Đã thu hồi", color: "red" },
};
const expiryLabel = (expiresAt: string | null) => (expiresAt ? shortDate(expiresAt) : "Không thời hạn");

export function PartnerDetailPage() {
  const { id = "" } = useParams();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["partner", id], queryFn: () => api.partner(id) });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [batch, setBatch] = useState("");
  const [count, setCount] = useState<number>(20);
  const [expiry, setExpiry] = useState("");
  const [filterBatch, setFilterBatch] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<AdminPartnerCode | null>(null);
  const [batchExpiry, setBatchExpiry] = useState<string | null>(null);

  const codes = query.data?.codes ?? [];
  const batches = useMemo(() => [...new Set(codes.map((c) => c.batch))], [codes]);
  const batchEnd = useMemo(() => new Map(codes.map((c) => [c.batch, c.expiresAt])), [codes]);
  const today = vnDateValue(new Date().toISOString());
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return codes.filter(
      (c) =>
        (!filterBatch || c.batch === filterBatch) &&
        (status === "all" || codeStatus(c) === status) &&
        (!needle || [c.code, c.userEmail ?? "", c.userName ?? ""].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [codes, filterBatch, status, q]);

  if (query.error) return <Alert color="red">{(query.error as Error).message}</Alert>;
  if (!query.data) return <Skeleton h={300} radius="lg" />;
  const { partner } = query.data;

  function applied(next: AdminPartnerDetail) {
    queryClient.setQueryData(["partner", id], next);
    queryClient.invalidateQueries({ queryKey: ["partners"] });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  }

  async function save(p: SavePartner) {
    setSaving(true);
    try {
      applied(await api.updatePartner(id, p));
      notifySaved();
      setEditing(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setSaving(true);
    try {
      const label = batch.trim();
      applied(await api.generatePartnerCodes(id, label, count, expiry ? endOfVnDay(expiry) : null));
      notifySaved(`Đã tạo ${count} mã cho lô “${label}”`);
      setFilterBatch(label);
      setStatus("all");
      setBatch("");
      setExpiry("");
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  function changeBatch(value: string) {
    setBatch(value);
    // An existing batch keeps one end date, so pick it up instead of letting the server reject a mismatch.
    const existing = batchEnd.get(value.trim());
    if (existing !== undefined) setExpiry(existing ? vnDateValue(existing) : "");
  }

  async function saveBatchExpiry() {
    if (!filterBatch || batchExpiry === null) return;
    setSaving(true);
    try {
      applied(await api.setPartnerBatchExpiry(id, filterBatch, batchExpiry ? endOfVnDay(batchExpiry) : null));
      notifySaved(`Đã đổi hạn lô “${filterBatch}”`);
      setBatchExpiry(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function setRevoked(code: AdminPartnerCode, revoked: boolean) {
    try {
      const updated = await api.setPartnerCodeRevoked(code.id, revoked);
      queryClient.setQueryData<AdminPartnerDetail>(["partner", id], (d) =>
        d ? { ...d, codes: d.codes.map((c) => (c.id === updated.id ? updated : c)) } : d,
      );
      queryClient.invalidateQueries({ queryKey: ["partner", id] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      notifySaved(revoked ? "Đã thu hồi mã" : "Đã khôi phục mã");
      setConfirm(null);
    } catch (e) {
      notifyError(e);
    }
  }

  async function exportCodes() {
    const { downloadTableXlsx, datedName } = await import("../sheets");
    const slug = partner.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await downloadTableXlsx(
      ["Mã", "Lô", "Hết hạn", "Trạng thái", "Học viên", "Email", "Ngày dùng"],
      shown.map((c) => [
        c.code,
        c.batch,
        expiryLabel(c.expiresAt),
        STATUS_BADGE[codeStatus(c)].label,
        c.userName ?? "",
        c.userEmail ?? "",
        c.usedAt ? shortDate(c.usedAt) : "",
      ]),
      `${datedName(`4ume-ma-${slug}`)}.xlsx`,
      "Mã học viên",
      [14, 24, 16, 14, 24, 30, 14],
    );
  }

  return (
    <Stack gap="md" maw={1100}>
      <Anchor component={Link} to="/partners" fz="sm">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Đối tác
        </Group>
      </Anchor>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <Badge variant="outline" color="gray" size="lg" ff="monospace">
              {partner.prefix}
            </Badge>
            <Title order={2}>{partner.name}</Title>
            {partner.features.map((f) => (
              <Badge key={f} variant="light" color="grape">
                {featureLabel(f)}
              </Badge>
            ))}
          </Group>
          <Text c="dimmed" fz="sm">
            {partner.students} học viên · {partner.unused} mã chưa dùng · {partner.ended} đã thu hồi/hết hạn · thêm ngày{" "}
            {shortDate(partner.createdAt)}
          </Text>
          {partner.note ? (
            <Text fz="sm" mt={4} style={{ whiteSpace: "pre-wrap" }}>
              {partner.note}
            </Text>
          ) : null}
        </div>
        <Group gap="sm">
          <Button variant="default" leftSection={<IconHistory size={18} />} onClick={() => setHistoryOpen(true)}>
            Lịch sử
          </Button>
          <Button variant="default" leftSection={<IconEdit size={18} />} onClick={() => setEditing(true)}>
            Sửa
          </Button>
        </Group>
      </Group>

      <Paper p="md" radius="lg" shadow="xs">
        <Text fw={700} fz="sm" tt="uppercase" c="dimmed" mb="xs">
          Tạo mã mới
        </Text>
        <Group align="flex-end" gap="sm">
          <TextInput
            flex={1}
            miw={200}
            label="Tên lô"
            description="Ví dụ lớp hoặc khoá học, để sau này lọc và xuất file"
            placeholder="IELTS 6.5 – K10/2026"
            maxLength={80}
            value={batch}
            onChange={(e) => changeBatch(e.currentTarget.value)}
          />
          <TextInput
            w={170}
            type="date"
            label="Hết hạn"
            description="Bỏ trống = không thời hạn"
            min={today}
            value={expiry}
            onChange={(e) => setExpiry(e.currentTarget.value)}
          />
          <NumberInput
            w={140}
            label="Số mã"
            min={1}
            max={500}
            value={count}
            onChange={(v) => setCount(typeof v === "number" ? Math.max(1, Math.min(500, Math.round(v))) : 1)}
          />
          <Button leftSection={<IconKey size={18} />} loading={saving} disabled={!batch.trim()} onClick={generate}>
            Tạo mã
          </Button>
        </Group>
        <Text fz="xs" c="dimmed" mt="xs">
          Mã có dạng {partner.prefix}-xxxxxx (6 số ngẫu nhiên), mỗi mã dùng được một lần. Hết hạn tính đến hết ngày đã chọn (giờ Việt Nam).
          Khi gửi mã cho trung tâm, nhắc học viên nhập trong app ở Hồ sơ → Mời bạn bè → “Nhập mã”.
        </Text>
      </Paper>

      <Paper p="md" radius="lg" shadow="xs">
        <Group justify="space-between" mb="sm" gap="sm">
          <Group gap="sm">
            <SegmentedControl size="xs" data={STATUSES} value={status} onChange={(v) => setStatus(v as Status)} />
            <Select
              size="xs"
              w={220}
              placeholder="Mọi lô"
              clearable
              data={batches}
              value={filterBatch}
              onChange={setFilterBatch}
            />
            {filterBatch ? (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconCalendar size={16} />}
                onClick={() => {
                  const end = batchEnd.get(filterBatch);
                  setBatchExpiry(end ? vnDateValue(end) : "");
                }}
              >
                Hạn lô: {expiryLabel(batchEnd.get(filterBatch) ?? null)}
              </Button>
            ) : null}
            <TextInput
              size="xs"
              w={200}
              leftSection={<IconSearch size={14} />}
              placeholder="Mã, tên hoặc email"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
            />
          </Group>
          <Button size="xs" variant="default" leftSection={<IconDownload size={16} />} disabled={shown.length === 0} onClick={exportCodes}>
            Xuất Excel ({shown.length})
          </Button>
        </Group>

        {shown.length === 0 ? (
          <Text c="dimmed" fz="sm" ta="center" py="lg">
            {codes.length === 0 ? "Chưa có mã nào. Tạo lô mã đầu tiên ở trên." : "Không có mã nào khớp bộ lọc."}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mã</Table.Th>
                  <Table.Th>Lô</Table.Th>
                  <Table.Th>Hết hạn</Table.Th>
                  <Table.Th>Trạng thái</Table.Th>
                  <Table.Th>Học viên</Table.Th>
                  <Table.Th>Ngày dùng</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((c) => {
                  const s = codeStatus(c);
                  return (
                    <Table.Tr key={c.id}>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text ff="monospace" fw={600}>
                            {c.code}
                          </Text>
                          <CopyButton value={c.code}>
                            {({ copied, copy }) => (
                              <Tooltip label={copied ? "Đã chép" : "Chép mã"}>
                                <ActionIcon variant="subtle" color={copied ? "teal" : "gray"} size="sm" onClick={copy}>
                                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </CopyButton>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{c.batch}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={c.expiresAt ? undefined : "dimmed"}>
                          {expiryLabel(c.expiresAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={STATUS_BADGE[s].color}>
                          {STATUS_BADGE[s].label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {c.userId ? (
                          <Anchor component={Link} to={`/users/${c.userId}`} fz="sm">
                            {c.userName} <Text span c="dimmed" fz="xs">{c.userEmail}</Text>
                            {c.heldDays > 0 ? (
                              <Text span c="dimmed" fz="xs">
                                {" "}
                                · giữ {c.heldDays} ngày Premium riêng
                              </Text>
                            ) : null}
                          </Anchor>
                        ) : c.usedAt ? (
                          <Text fz="sm" c="dimmed">
                            Tài khoản đã xoá
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{c.usedAt ? shortDate(c.usedAt) : ""}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        {c.revokedAt ? (
                          <Button size="compact-xs" variant="subtle" onClick={() => setRevoked(c, false)}>
                            Khôi phục
                          </Button>
                        ) : (
                          <Button size="compact-xs" variant="subtle" color="red" onClick={() => (c.usedAt ? setConfirm(c) : setRevoked(c, true))}>
                            Thu hồi
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <PartnerBillingCard partnerId={id} partnerName={partner.name} />

      <Modal
        opened={batchExpiry !== null}
        onClose={() => setBatchExpiry(null)}
        title={`Đổi hạn lô “${filterBatch ?? ""}”`}
        centered
        size={desktop ? "md" : "100%"}
      >
        <Stack>
          <TextInput
            type="date"
            label="Hết hạn"
            description="Bỏ trống = không thời hạn. Áp dụng cho mọi mã trong lô, kể cả mã đang dùng."
            min={today}
            value={batchExpiry ?? ""}
            onChange={(e) => setBatchExpiry(e.currentTarget.value)}
          />
          <Text fz="sm" c="dimmed">
            Gia hạn lô đã hết hạn sẽ mở lại Premium cho học viên trong lô. Muốn dừng ngay một học viên thì thu hồi mã của người đó.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBatchExpiry(null)}>
              Huỷ
            </Button>
            <Button loading={saving} onClick={saveBatchExpiry}>
              Lưu
            </Button>
          </Group>
        </Stack>
      </Modal>

      <PartnerFormModal opened={editing} partner={partner} saving={saving} onClose={() => setEditing(false)} onSave={save} />
      <Modal opened={!!confirm} onClose={() => setConfirm(null)} title="Thu hồi mã đang dùng?" centered size={desktop ? "md" : "100%"}>
        <Stack>
          <Text fz="sm">
            <b>{confirm?.userName}</b> ({confirm?.userEmail}) sẽ mất Premium và các tính năng của {partner.name} ngay lần mở app tiếp theo.
            {confirm?.heldDays ? ` ${confirm.heldDays} ngày Premium riêng đang tạm dừng sẽ được trả lại.` : ""} Phí của học viên này
            tính đến hết nửa tháng có ngày thu hồi. Có thể khôi phục lại sau.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirm(null)}>
              Huỷ
            </Button>
            <Button color="red" onClick={() => confirm && setRevoked(confirm, true)}>
              Thu hồi
            </Button>
          </Group>
        </Stack>
      </Modal>
      <HistoryDrawer
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="partner"
        entityId={id}
        title={partner.name}
        onRestored={() => setHistoryOpen(false)}
      />
    </Stack>
  );
}
