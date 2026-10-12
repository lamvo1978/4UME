import { Alert, Anchor, Button, Group, Paper, Skeleton, Table, Text, TextInput } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { shortDate } from "../lib";
import { currentVnMonth } from "./dates";

const units = (n: number) => n.toLocaleString("vi-VN");

/** Students active in a month and what each counts for, so the centre can be billed or asked to revoke codes. */
export function PartnerBillingCard({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const [month, setMonth] = useState(currentVnMonth());
  const query = useQuery({
    queryKey: ["partner-billing", partnerId, month],
    queryFn: () => api.partnerBilling(partnerId, month),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });
  const rows = query.data?.rows ?? [];
  const [year, m] = month.split("-");

  async function exportRows() {
    if (!query.data) return;
    const { downloadTableXlsx } = await import("../sheets");
    const slug = partnerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await downloadTableXlsx(
      ["Mã", "Lô", "Học viên", "Email", "Bắt đầu", "Kết thúc", "Số tháng tính phí"],
      [
        ...rows.map((r) => [
          r.code,
          r.batch,
          r.userName ?? (r.userId ? "" : "Tài khoản đã xoá"),
          r.userEmail ?? "",
          shortDate(r.startedAt),
          r.endedAt ? shortDate(r.endedAt) : "Đang dùng",
          r.units,
        ]),
        ["", "", "", "", "", "Tổng", query.data.units],
      ],
      `4ume-thong-ke-${slug}-${month}.xlsx`,
      `Tháng ${m}-${year}`,
      [14, 24, 24, 30, 14, 14, 18],
    );
  }

  return (
    <Paper p="md" radius="lg" shadow="xs">
      <Group justify="space-between" align="flex-end" mb="sm" gap="sm">
        <div>
          <Text fw={700} fz="sm" tt="uppercase" c="dimmed">
            Thống kê tháng
          </Text>
          <Text fz="xs" c="dimmed" maw={560}>
            Học viên còn dùng trong tháng. Mỗi học viên tính nửa tháng cho mỗi nửa tháng có dùng (ngày 1–15 và 16–cuối tháng): bắt đầu ngày
            1–15 hoặc kết thúc từ ngày 16 tính trọn tháng, bắt đầu từ ngày 16 tính 1/2 tháng.
          </Text>
        </div>
        <Group gap="sm" align="flex-end">
          <TextInput size="xs" type="month" label="Tháng" value={month} onChange={(e) => setMonth(e.currentTarget.value)} />
          <Button size="xs" variant="default" leftSection={<IconDownload size={16} />} disabled={rows.length === 0} onClick={exportRows}>
            Xuất Excel
          </Button>
        </Group>
      </Group>

      {query.error ? <Alert color="red">{(query.error as Error).message}</Alert> : null}
      {query.isLoading ? <Skeleton h={80} radius="md" /> : null}
      {query.data ? (
        rows.length === 0 ? (
          <Text c="dimmed" fz="sm" ta="center" py="md">
            Tháng này không có học viên nào dùng mã.
          </Text>
        ) : (
          <>
            <Text fz="sm" mb="xs">
              <b>{rows.length}</b> học viên · tổng <b>{units(query.data.units)}</b> tháng tính phí
            </Text>
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Mã</Table.Th>
                    <Table.Th>Lô</Table.Th>
                    <Table.Th>Học viên</Table.Th>
                    <Table.Th>Bắt đầu</Table.Th>
                    <Table.Th>Kết thúc</Table.Th>
                    <Table.Th ta="right">Tháng phí</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r) => (
                    <Table.Tr key={r.code}>
                      <Table.Td>
                        <Text ff="monospace" fz="sm">
                          {r.code}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{r.batch}</Text>
                      </Table.Td>
                      <Table.Td>
                        {r.userId ? (
                          <Anchor component={Link} to={`/users/${r.userId}`} fz="sm">
                            {r.userName} <Text span c="dimmed" fz="xs">{r.userEmail}</Text>
                          </Anchor>
                        ) : (
                          <Text fz="sm" c="dimmed">
                            Tài khoản đã xoá
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{shortDate(r.startedAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={r.endedAt ? undefined : "teal"}>
                          {r.endedAt ? shortDate(r.endedAt) : "Đang dùng"}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz="sm" fw={600}>
                          {units(r.units)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )
      ) : null}
    </Paper>
  );
}
