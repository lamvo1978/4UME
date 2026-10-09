import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Menu,
  Pagination,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconChevronDown, IconDownload, IconFileSpreadsheet, IconPhotoOff, IconPlus, IconSearch, IconUpload } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, mediaSrc, type AdminWord, type WordFilters } from "../api";
import { Select } from "../components/AppSelect";
import { notifyError, notifySaved, posLabel } from "../lib";

const PAGE_SIZE = 50;

const MISSING = [
  { value: "has-image", label: "Đã có hình" },
  { value: "image", label: "Chưa có hình" },
  { value: "image-review", label: "Ảnh chưa duyệt" },
  { value: "example", label: "Thiếu câu ví dụ" },
  { value: "ipa", label: "Thiếu phiên âm" },
];
const VISIBILITY = [
  { value: "true", label: "Đang hiện" },
  { value: "false", label: "Đã ẩn" },
];

export function WordsPage() {
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debouncedQ] = useDebouncedValue(q, 300);

  const filters: WordFilters = {
    q: params.get("q") ?? undefined,
    deckId: params.get("deck") ?? undefined,
    level: params.get("level") ?? undefined,
    pos: params.get("pos") ?? undefined,
    missing: params.get("missing") ?? undefined,
    published: params.get("published") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: PAGE_SIZE,
  };

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedQ) setFilter("q", debouncedQ.trim() || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: 60_000 });
  const words = useQuery({
    queryKey: ["words", filters],
    queryFn: () => api.words(filters),
    placeholderData: keepPreviousData,
  });
  const pages = words.data ? Math.max(1, Math.ceil(words.data.total / PAGE_SIZE)) : 1;
  const open = (w: AdminWord) => navigate(`/words/${encodeURIComponent(w.id)}`);

  const [exporting, setExporting] = useState(false);
  const hasFilters = ["q", "deck", "level", "pos", "missing", "published"].some((k) => params.get(k));

  async function exportAs(format: "xlsx" | "csv" | "json") {
    setExporting(true);
    try {
      const [list, { datedName, downloadJson, downloadWordsCsv, downloadWordsXlsx }] = await Promise.all([
        api.exportWords(filters),
        import("../sheets"),
      ]);
      const name = datedName(hasFilters ? "4ume-tu-vung-loc" : "4ume-tu-vung");
      if (format === "xlsx") await downloadWordsXlsx(list, `${name}.xlsx`);
      else if (format === "csv") downloadWordsCsv(list, `${name}.csv`);
      else downloadJson(list, `${name}.json`);
      notifySaved(`Đã xuất ${list.length.toLocaleString("vi-VN")} từ`);
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack gap="md" maw={1300}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Từ vựng</Title>
          <Text c="dimmed" fz="sm">
            {words.data ? `${words.data.total.toLocaleString("vi-VN")} từ` : "…"}
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Menu position="bottom-end" width={240}>
            <Menu.Target>
              {desktop ? (
                <Button variant="default" leftSection={<IconFileSpreadsheet size={18} />} rightSection={<IconChevronDown size={16} />} loading={exporting}>
                  Nhập / Xuất
                </Button>
              ) : (
                <ActionIcon variant="default" size={42} radius="md" loading={exporting} aria-label="Nhập / Xuất">
                  <IconFileSpreadsheet size={20} />
                </ActionIcon>
              )}
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUpload size={16} />} component={Link} to="/words/import">
                Nhập từ file Excel / CSV
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{hasFilters ? "Xuất các từ đang lọc" : "Xuất toàn bộ từ vựng"}</Menu.Label>
              <Menu.Item leftSection={<IconDownload size={16} />} onClick={() => exportAs("xlsx")}>
                Excel (.xlsx)
              </Menu.Item>
              <Menu.Item leftSection={<IconDownload size={16} />} onClick={() => exportAs("csv")}>
                CSV
              </Menu.Item>
              <Menu.Item leftSection={<IconDownload size={16} />} onClick={() => exportAs("json")}>
                JSON (sao lưu)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button component={Link} to="/words/new" leftSection={<IconPlus size={18} />}>
            Thêm từ
          </Button>
        </Group>
      </Group>

      <Paper p="sm" radius="lg" shadow="xs">
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="xs">
          <TextInput
            style={{ gridColumn: desktop ? undefined : "1 / -1" }}
            type="search" autoComplete="off" placeholder="Tìm từ hoặc nghĩa…"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
          <Select
            placeholder="Bộ từ"
            clearable
            searchable
            data={meta.data?.decks.map((d) => ({ value: d.id, label: d.titleVi })) ?? []}
            value={filters.deckId ?? null}
            onChange={(v) => setFilter("deck", v)}
          />
          <Select
            placeholder="Cấp độ"
            clearable
            data={meta.data?.levels ?? []}
            value={filters.level ?? null}
            onChange={(v) => setFilter("level", v)}
          />
          <Select
            placeholder="Loại từ"
            clearable
            data={meta.data?.partsOfSpeech.map((p) => ({ value: p, label: posLabel(p) })) ?? []}
            value={filters.pos ?? null}
            onChange={(v) => setFilter("pos", v)}
          />
          <Select placeholder="Hình ảnh / bổ sung" clearable data={MISSING} value={filters.missing ?? null} onChange={(v) => setFilter("missing", v)} />
          <Select placeholder="Hiển thị" clearable data={VISIBILITY} value={filters.published ?? null} onChange={(v) => setFilter("published", v)} />
        </SimpleGrid>
      </Paper>

      {words.error ? <Alert color="red">{(words.error as Error).message}</Alert> : null}

      {words.isLoading ? (
        <Stack gap="xs">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} h={56} radius="md" />
          ))}
        </Stack>
      ) : desktop ? (
        <Paper radius="lg" shadow="xs" style={{ overflow: "hidden", opacity: words.isFetching ? 0.6 : 1 }}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={56} />
                <Table.Th>Từ</Table.Th>
                <Table.Th>Nghĩa</Table.Th>
                <Table.Th>Bộ</Table.Th>
                <Table.Th w={70}>Cấp</Table.Th>
                <Table.Th w={110}>Trạng thái</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {words.data?.items.map((w) => (
                <Table.Tr key={w.id} onClick={() => open(w)} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    <Thumb url={w.imageUrl} />
                  </Table.Td>
                  <Table.Td>
                    <Text fw={700}>{w.word}</Text>
                    <Text fz="xs" c="dimmed">
                      {posLabel(w.pos)} · {w.ipa || "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td maw={320}>
                    <Text fz="sm" lineClamp={2}>
                      {w.meaningVi}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{w.deckTitleVi}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{w.level}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadges word={w} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : (
        <Stack gap="xs" style={{ opacity: words.isFetching ? 0.6 : 1 }}>
          {words.data?.items.map((w) => (
            <Card key={w.id} radius="lg" shadow="xs" p="sm" onClick={() => open(w)} style={{ cursor: "pointer" }}>
              <Group wrap="nowrap" align="flex-start">
                <Thumb url={w.imageUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6}>
                    <Text fw={700}>{w.word}</Text>
                    <Text fz="xs" c="dimmed">
                      {posLabel(w.pos)} · {w.level}
                    </Text>
                  </Group>
                  <Text fz="sm" lineClamp={1}>
                    {w.meaningVi}
                  </Text>
                  <Text fz="xs" c="dimmed" truncate>
                    {w.deckTitleVi}
                  </Text>
                </div>
                <StatusBadges word={w} />
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {words.data && words.data.items.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Không có từ nào khớp bộ lọc.
        </Text>
      ) : null}

      {pages > 1 ? (
        <Group justify="center">
          <Pagination total={pages} value={filters.page ?? 1} onChange={(p) => setFilter("page", String(p))} siblings={desktop ? 1 : 0} />
        </Group>
      ) : null}
    </Stack>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <Image src={mediaSrc(url)} w={44} h={44} radius="sm" fit="cover" alt="" />
  ) : (
    <div style={{ width: 44, height: 44, borderRadius: 6, background: "#F1F5F3", display: "grid", placeItems: "center" }}>
      <IconPhotoOff size={18} color="#B9C9C2" />
    </div>
  );
}

function StatusBadges({ word }: { word: AdminWord }) {
  return (
    <Stack gap={4} align="flex-start">
      {word.published ? (
        <Badge color="green" variant="light" size="sm">
          Đang hiện
        </Badge>
      ) : (
        <Badge color="gray" variant="filled" size="sm">
          Đã ẩn
        </Badge>
      )}
      {word.editedAt ? (
        <Badge color="orange" variant="light" size="sm">
          Đã sửa
        </Badge>
      ) : null}
      {word.imagePending ? (
        <Badge color="yellow" variant="light" size="sm">
          Ảnh chưa duyệt
        </Badge>
      ) : null}
    </Stack>
  );
}
