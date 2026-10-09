import { ActionIcon, Alert, Badge, Button, Group, Menu, Paper, SegmentedControl, Skeleton, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconDownload, IconFileCode, IconPlus, IconSearch, IconUpload } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type AdminGrammarSummary } from "../api";
import { GrammarImportModal } from "../grammar/GrammarImportModal";
import { LEVELS } from "../grammar/meta";
import { notifyError, notifySaved } from "../lib";
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();

export function GrammarPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lessons = useQuery({ queryKey: ["grammar"], queryFn: api.grammarLessons });
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      const [data, { datedName, downloadJson }] = await Promise.all([api.exportGrammar(), import("../sheets")]);
      downloadJson(data, `${datedName("4ume-ngu-phap")}.json`);
      notifySaved(`Đã xuất ${data.length} bài`);
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  }

  const all = lessons.data ?? [];
  const filtering = q.trim() !== "" || level !== "all";
  const list = all.filter(
    (l) =>
      (level === "all" || l.level === level) &&
      (!q.trim() || fold(`${l.titleVi} ${l.titleEn ?? ""} ${l.slug}`).includes(fold(q.trim()))),
  );

  async function move(index: number, delta: number) {
    const next = [...all];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    queryClient.setQueryData(["grammar"], next);
    try {
      await api.reorderGrammar(next.map((l) => l.slug));
    } catch (e) {
      notifyError(e);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["grammar"] });
    }
  }

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Ngữ pháp</Title>
          <Text c="dimmed" fz="sm">
            {all.length} bài · thứ tự ở đây là lộ trình trong app
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Menu position="bottom-end" width={220}>
            <Menu.Target>
              <ActionIcon variant="default" size={42} radius="md" loading={exporting} aria-label="Nhập / Xuất JSON">
                <IconFileCode size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUpload size={16} />} onClick={() => setImporting(true)}>
                Nhập từ file JSON
              </Menu.Item>
              <Menu.Item leftSection={<IconDownload size={16} />} onClick={exportAll}>
                Xuất tất cả bài (JSON)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button component={Link} to="/grammar/new" leftSection={<IconPlus size={18} />}>
            Thêm bài
          </Button>
        </Group>
      </Group>
      <GrammarImportModal opened={importing} onClose={() => setImporting(false)} />

      <Paper p="sm" radius="lg" shadow="xs">
        <Group gap="sm" wrap="wrap">
          <TextInput style={{ flex: 1, minWidth: 200 }} type="search" autoComplete="off" placeholder="Tìm bài…" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} />
          <SegmentedControl value={level} onChange={setLevel} data={[{ value: "all", label: "Tất cả" }, ...LEVELS.map((l) => ({ value: l, label: l }))]} />
        </Group>
      </Paper>

      {lessons.error ? <Alert color="red">{(lessons.error as Error).message}</Alert> : null}
      {lessons.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {list.map((l) => {
          const index = all.indexOf(l);
          return (
            <Paper
              key={l.slug}
              p="sm"
              radius="lg"
              shadow="xs"
              style={{ cursor: "pointer", opacity: l.published ? 1 : 0.65 }}
              onClick={() => navigate(`/grammar/${l.slug}`)}
            >
              <Group wrap="nowrap" gap="sm">
                {!filtering ? (
                  <Stack gap={2} onClick={(e) => e.stopPropagation()}>
                    <ActionIcon variant="subtle" size="sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Lên">
                      <IconArrowUp size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" size="sm" disabled={index === all.length - 1} onClick={() => move(index, 1)} aria-label="Xuống">
                      <IconArrowDown size={16} />
                    </ActionIcon>
                  </Stack>
                ) : null}
                <Text fw={800} c="dimmed" w={28} ta="center">
                  {index + 1}
                </Text>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <Badge size="sm" radius="sm" variant="filled">
                      {l.level}
                    </Badge>
                    <Text fw={700} truncate>
                      {l.titleVi}
                    </Text>
                  </Group>
                  <Text fz="sm" c="dimmed" truncate>
                    {l.titleEn ? `${l.titleEn} · ` : ""}
                    {l.sectionCount} khối lý thuyết · {l.exerciseCount} câu bài tập
                    {l.learners ? ` · ${l.learners} người đã học` : ""}
                  </Text>
                </div>
                <Group gap={6} wrap="nowrap">
                  <LessonBadges lesson={l} />
                </Group>
              </Group>
            </Paper>
          );
        })}
      </Stack>
      {lessons.data && list.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Không có bài nào khớp.
        </Text>
      ) : null}
    </Stack>
  );
}

function LessonBadges({ lesson: l }: { lesson: AdminGrammarSummary }) {
  const thin = l.exerciseCount < l.quizSize + 4;
  return (
    <>
      {thin ? (
        <Tooltip label={`Nên có ít nhất ${l.quizSize + 4} câu để mỗi lần luyện khác nhau`}>
          <Badge size="sm" color="orange" variant="light" leftSection={<IconAlertTriangle size={12} />}>
            Ít câu
          </Badge>
        </Tooltip>
      ) : null}
      {l.editedAt ? (
        <Badge size="sm" color="orange" variant="light" visibleFrom="sm">
          Đã sửa
        </Badge>
      ) : null}
      {l.published ? (
        <Badge size="sm" color="green" variant="light">
          Đang hiện
        </Badge>
      ) : (
        <Badge size="sm" color="gray" variant="filled">
          Đã ẩn
        </Badge>
      )}
    </>
  );
}
