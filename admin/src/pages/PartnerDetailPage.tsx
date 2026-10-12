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
import { IconArrowLeft, IconCheck, IconCopy, IconDownload, IconEdit, IconHistory, IconKey, IconSearch } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, featureLabel, type AdminPartnerCode, type AdminPartnerDetail, type SavePartner } from "../api";
import { Select } from "../components/AppSelect";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { notifyError, notifySaved, shortDate } from "../lib";
import { PartnerFormModal } from "../partners/PartnerFormModal";

type Status = "all" | "unused" | "used" | "revoked";
const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unused", label: "Chưa dùng" },
  { value: "used", label: "Đang dùng" },
  { value: "revoked", label: "Đã thu hồi" },
];

const codeStatus = (c: AdminPartnerCode): Exclude<Status, "all"> => (c.revokedAt ? "revoked" : c.usedAt ? "used" : "unused");
const STATUS_BADGE: Record<Exclude<Status, "all">, { label: string; color: string }> = {
  unused: { label: "Chưa dùng", color: "gray" },
  used: { label: "Đang dùng", color: "teal" },
  revoked: { label: "Đã thu hồi", color: "red" },
};

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
  const [filterBatch, setFilterBatch] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<AdminPartnerCode | null>(null);

  const codes = query.data?.codes ?? [];
  const batches = useMemo(() => [...new Set(codes.map((c) => c.batch))], [codes]);
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
      applied(await api.generatePartnerCodes(id, label, count));
      notifySaved(`Đã tạo ${count} mã cho lô “${label}”`);
      setFilterBatch(label);
      setStatus("all");
      setBatch("");
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
      ["Mã", "Lô", "Trạng thái", "Học viên", "Email", "Ngày dùng"],
      shown.map((c) => [c.code, c.batch, STATUS_BADGE[codeStatus(c)].label, c.userName ?? "", c.userEmail ?? "", c.usedAt ? shortDate(c.usedAt) : ""]),
      `${datedName(`4ume-ma-${slug}`)}.xlsx`,
      "Mã học viên",
      [14, 24, 14, 24, 30, 14],
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
            <Title order={2}>{partner.name}</Title>
            {partner.features.map((f) => (
              <Badge key={f} variant="light" color="grape">
                {featureLabel(f)}
              </Badge>
            ))}
          </Group>
          <Text c="dimmed" fz="sm">
            {partner.students} học viên · {partner.unused} mã chưa dùng · {partner.revoked} đã thu hồi · thêm ngày {shortDate(partner.createdAt)}
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
            onChange={(e) => setBatch(e.currentTarget.value)}
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
          Mỗi mã dùng được một lần. Khi gửi mã cho trung tâm, nhắc học viên nhập trong app ở Hồ sơ → Mời bạn bè → “Nhập mã”.
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
                        <Badge variant="light" color={STATUS_BADGE[s].color}>
                          {STATUS_BADGE[s].label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {c.userId ? (
                          <Anchor component={Link} to={`/users/${c.userId}`} fz="sm">
                            {c.userName} <Text span c="dimmed" fz="xs">{c.userEmail}</Text>
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

      <PartnerFormModal opened={editing} partner={partner} saving={saving} onClose={() => setEditing(false)} onSave={save} />
      <Modal opened={!!confirm} onClose={() => setConfirm(null)} title="Thu hồi mã đang dùng?" centered size={desktop ? "md" : "100%"}>
        <Stack>
          <Text fz="sm">
            <b>{confirm?.userName}</b> ({confirm?.userEmail}) sẽ mất Premium và các tính năng của {partner.name} ngay lần mở app tiếp theo. Ngày
            Premium có từ nguồn khác (mời bạn, admin cấp) vẫn giữ nguyên. Có thể khôi phục lại sau.
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
