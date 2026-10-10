import { ActionIcon, Alert, Badge, Button, Card, Group, Pagination, Paper, SegmentedControl, Skeleton, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch, IconSettings } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type AdminFeedbackSummary, type FeedbackQuery } from "../api";
import { Select } from "../components/AppSelect";
import { CATEGORIES, categoryMeta, STATUSES } from "../feedback/meta";
import { timeAgo } from "../lib";

const PAGE_SIZE = 30;

export function FeedbackPage() {
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debouncedQ] = useDebouncedValue(q.trim(), 300);

  const filters: FeedbackQuery = {
    status: params.get("status") ?? "active",
    category: params.get("category") ?? undefined,
    q: params.get("q") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: PAGE_SIZE,
  };

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedQ) setParam("q", debouncedQ || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const list = useQuery({
    queryKey: ["feedback", filters],
    queryFn: () => api.feedbackList({ ...filters, status: filters.status === "all" ? undefined : filters.status }),
    placeholderData: keepPreviousData,
  });
  const counts = list.data?.counts;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;
  const open = (t: AdminFeedbackSummary) => navigate(`/feedback/${t.id}`);

  const tabs = [
    { value: "active", label: `Đang mở${counts ? ` (${counts.open + counts.answered})` : ""}` },
    { value: "unread", label: `Chưa đọc${counts ? ` (${counts.unread})` : ""}` },
    { value: "open", label: `Chờ trả lời${counts ? ` (${counts.open})` : ""}` },
    { value: "answered", label: `Đã trả lời${counts ? ` (${counts.answered})` : ""}` },
    { value: "closed", label: `Đã đóng${counts ? ` (${counts.closed})` : ""}` },
    { value: "all", label: "Tất cả" },
  ];

  return (
    <Stack gap="md" maw={1200}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={2}>Góp ý</Title>
          <Text c="dimmed" fz="sm">
            Góp ý và báo lỗi gửi từ app. Trả lời ở đây, người dùng thấy chấm đỏ trên chuông và đọc trong app.
          </Text>
        </div>
        {desktop ? (
          <Button component={Link} to="/feedback/settings" variant="default" leftSection={<IconSettings size={18} />} style={{ flexShrink: 0 }}>
            Cài đặt góp ý
          </Button>
        ) : (
          <ActionIcon component={Link} to="/feedback/settings" variant="default" size={42} radius="md" aria-label="Cài đặt góp ý">
            <IconSettings size={20} />
          </ActionIcon>
        )}
      </Group>

      <Paper p="sm" radius="lg" shadow="xs">
        <Stack gap="xs">
          {desktop ? (
            <SegmentedControl data={tabs} value={filters.status ?? "active"} onChange={(v) => setParam("status", v === "active" ? null : v)} />
          ) : (
            <Select data={tabs} value={filters.status ?? "active"} onChange={(v) => setParam("status", v === "active" ? null : v)} allowDeselect={false} />
          )}
          <Group gap="xs" wrap={desktop ? "nowrap" : "wrap"}>
            <TextInput
              type="search"
              autoComplete="off"
              placeholder="Tìm theo nội dung, tên hoặc email…"
              leftSection={<IconSearch size={16} />}
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
              style={desktop ? { flex: 1, minWidth: 220 } : { flexBasis: "100%" }}
            />
            <Select
              data={[{ value: "", label: "Mọi loại" }, ...CATEGORIES]}
              value={filters.category ?? ""}
              onChange={(v) => setParam("category", v || null)}
              allowDeselect={false}
              w={desktop ? 170 : undefined}
              style={desktop ? undefined : { flex: 1 }}
            />
          </Group>
        </Stack>
      </Paper>

      {list.error ? <Alert color="red">{(list.error as Error).message}</Alert> : null}

      {list.isLoading ? (
        <Stack gap="xs">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={60} radius="md" />
          ))}
        </Stack>
      ) : desktop ? (
        <Paper radius="lg" shadow="xs" style={{ overflow: "hidden", opacity: list.isFetching ? 0.6 : 1 }}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nội dung</Table.Th>
                <Table.Th w={230}>Người gửi</Table.Th>
                <Table.Th w={130}>Trạng thái</Table.Th>
                <Table.Th w={130}>Cập nhật</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.data?.items.map((t) => (
                <Table.Tr key={t.id} onClick={() => open(t)} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    <Subject ticket={t} />
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" truncate>
                      {t.user.displayName}
                    </Text>
                    <Text fz="xs" c="dimmed" truncate>
                      {t.user.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={STATUSES[t.status].color}>
                      {STATUSES[t.status].label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{timeAgo(t.lastMessageAt)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : (
        <Stack gap="xs" style={{ opacity: list.isFetching ? 0.6 : 1 }}>
          {list.data?.items.map((t) => (
            <Card key={t.id} radius="lg" shadow="xs" p="sm" onClick={() => open(t)} style={{ cursor: "pointer" }}>
              <Subject ticket={t} />
              <Group gap={6} mt={6}>
                <Badge size="sm" variant="light" color={STATUSES[t.status].color}>
                  {STATUSES[t.status].label}
                </Badge>
                <Text fz="xs" c="dimmed" truncate>
                  {t.user.displayName} · {timeAgo(t.lastMessageAt)}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {list.data && list.data.items.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Không có góp ý nào ở mục này.
        </Text>
      ) : null}

      {pages > 1 ? (
        <Group justify="center">
          <Pagination total={pages} value={filters.page ?? 1} onChange={(p) => setParam("page", String(p))} siblings={desktop ? 1 : 0} />
        </Group>
      ) : null}
    </Stack>
  );
}

function Subject({ ticket }: { ticket: AdminFeedbackSummary }) {
  const cat = categoryMeta(ticket.category);
  return (
    <div style={{ minWidth: 0 }}>
      <Group gap={6} wrap="nowrap">
        {ticket.unread ? <span aria-label="Chưa đọc" style={{ width: 8, height: 8, borderRadius: 4, background: "var(--mantine-color-red-6)", flexShrink: 0 }} /> : null}
        <Badge size="sm" variant="light" color={cat.color} style={{ flexShrink: 0 }}>
          {cat.label}
        </Badge>
        <Text fw={ticket.unread ? 700 : 500} truncate>
          {ticket.subject}
        </Text>
      </Group>
      <Text fz="xs" c="dimmed" mt={2}>
        {ticket.messages} tin nhắn{ticket.wordText ? ` · Từ "${ticket.wordText}"` : ""}
      </Text>
    </div>
  );
}
