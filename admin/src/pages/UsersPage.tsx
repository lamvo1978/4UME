import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type AdminUser, type UserFilter, type UserQuery } from "../api";
import { Select } from "../components/AppSelect";
import { shortDate, studyAgo } from "../lib";
import { CreateUserModal } from "../users/CreateUserModal";
import { Streak, UserAvatar, UserBadges } from "../users/UserBadges";

const PAGE_SIZE = 30;

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Học 7 ngày qua" },
  { value: "inactive", label: "Lâu không học" },
  { value: "premium", label: "Premium" },
  { value: "admin", label: "Quản trị" },
  { value: "locked", label: "Đã khoá" },
];
const SORTS = [
  { value: "new", label: "Mới tham gia" },
  { value: "active", label: "Học gần đây" },
  { value: "name", label: "Tên A–Z" },
];

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(false);
  const [debouncedQ] = useDebouncedValue(q.trim(), 300);

  const filters: UserQuery = {
    q: params.get("q") ?? undefined,
    filter: (params.get("filter") ?? "") as UserFilter,
    sort: params.get("sort") ?? "new",
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

  const users = useQuery({ queryKey: ["users", filters], queryFn: () => api.users(filters), placeholderData: keepPreviousData });
  const pages = users.data ? Math.max(1, Math.ceil(users.data.total / PAGE_SIZE)) : 1;
  const open = (u: AdminUser) => navigate(`/users/${u.id}`);

  return (
    <Stack gap="md" maw={1200}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={2}>Người dùng</Title>
          <Text c="dimmed" fz="sm">
            {users.data ? `${users.data.total.toLocaleString("vi-VN")} tài khoản. ` : ""}
            Tài khoản tạo trên app là người học; chỉ tài khoản được cấp quyền quản trị mới vào được trang này.
          </Text>
        </div>
        {desktop ? (
          <Button leftSection={<IconUserPlus size={18} />} onClick={() => setCreating(true)} style={{ flexShrink: 0 }}>
            Thêm tài khoản
          </Button>
        ) : (
          <ActionIcon size={42} radius="md" onClick={() => setCreating(true)} aria-label="Thêm tài khoản">
            <IconUserPlus size={20} />
          </ActionIcon>
        )}
      </Group>
      <CreateUserModal opened={creating} onClose={() => setCreating(false)} onCreated={(d) => navigate(`/users/${d.user.id}`)} />

      <Paper p="sm" radius="lg" shadow="xs">
        <Group gap="xs" wrap={desktop ? "nowrap" : "wrap"}>
          <TextInput
            type="search" autoComplete="off" placeholder="Tìm theo tên hoặc email…"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            style={desktop ? { flex: 1, minWidth: 220 } : { flexBasis: "100%" }}
          />
          {desktop ? (
            <SegmentedControl data={FILTERS} value={filters.filter ?? ""} onChange={(v) => setParam("filter", v || null)} />
          ) : (
            <Select
              data={FILTERS}
              value={filters.filter ?? ""}
              onChange={(v) => setParam("filter", v || null)}
              allowDeselect={false}
              style={{ flex: 1 }}
            />
          )}
          <Select
            data={SORTS}
            value={filters.sort ?? "new"}
            onChange={(v) => setParam("sort", v === "new" ? null : v)}
            allowDeselect={false}
            w={desktop ? 170 : undefined}
            style={desktop ? undefined : { flex: 1 }}
          />
        </Group>
      </Paper>

      {users.error ? <Alert color="red">{(users.error as Error).message}</Alert> : null}

      {users.isLoading ? (
        <Stack gap="xs">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} h={60} radius="md" />
          ))}
        </Stack>
      ) : desktop ? (
        <Paper radius="lg" shadow="xs" style={{ overflow: "hidden", opacity: users.isFetching ? 0.6 : 1 }}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Người dùng</Table.Th>
                <Table.Th w={130}>Tham gia</Table.Th>
                <Table.Th w={140}>Học gần nhất</Table.Th>
                <Table.Th w={90}>Chuỗi</Table.Th>
                <Table.Th w={110}>Từ đã thuộc</Table.Th>
                <Table.Th w={110}>Ngữ pháp</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.data?.items.map((u) => (
                <Table.Tr key={u.id} onClick={() => open(u)} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <UserAvatar user={u} />
                      <div style={{ minWidth: 0 }}>
                        <Group gap={6} wrap="nowrap">
                          <Text fw={700} truncate>
                            {u.displayName}
                          </Text>
                          <UserBadges user={u} />
                        </Group>
                        <Text fz="xs" c="dimmed" truncate>
                          {u.email}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{shortDate(u.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <LastStudy date={u.lastStudyDate} />
                  </Table.Td>
                  <Table.Td>
                    <Streak value={u.currentStreak} />
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{u.knownWords.toLocaleString("vi-VN")}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{u.grammarPassed} bài</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : (
        <Stack gap="xs" style={{ opacity: users.isFetching ? 0.6 : 1 }}>
          {users.data?.items.map((u) => (
            <Card key={u.id} radius="lg" shadow="xs" p="sm" onClick={() => open(u)} style={{ cursor: "pointer" }}>
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <UserAvatar user={u} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap" justify="space-between">
                    <Text fw={700} truncate>
                      {u.displayName}
                    </Text>
                    <Streak value={u.currentStreak} />
                  </Group>
                  <Text fz="xs" c="dimmed" truncate>
                    {u.email}
                  </Text>
                  <Group gap={6} mt={4}>
                    <UserBadges user={u} />
                    <Text fz="xs" c="dimmed">
                      {u.lastStudyDate ? `Học ${studyAgo(u.lastStudyDate)}` : "Chưa học"} · {u.knownWords} từ · {u.grammarPassed} bài
                    </Text>
                  </Group>
                </div>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {users.data && users.data.items.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Không có người dùng nào khớp bộ lọc.
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

function LastStudy({ date }: { date: string | null }) {
  const text = studyAgo(date);
  const stale = !date || text.endsWith("ngày trước");
  return (
    <Text fz="sm" c={stale ? "dimmed" : undefined}>
      {text}
    </Text>
  );
}