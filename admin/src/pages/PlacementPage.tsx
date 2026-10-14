import { ActionIcon, Alert, Badge, Button, Group, Menu, Paper, SegmentedControl, Skeleton, Stack, Switch, Text, Title, Tooltip } from "@mantine/core";
import { IconDownload, IconFileCode, IconPencil, IconPlus, IconSparkles, IconTrash, IconUpload } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type PlacementGrammarInput, type PlacementGrammarQuestion, type PlacementLevel } from "../api";
import { notifyError, notifySaved } from "../lib";
import { PlacementDraftModal } from "../placement/PlacementDraftModal";
import { PlacementImportModal } from "../placement/PlacementImportModal";
import { PlacementQuestionModal } from "../placement/PlacementQuestionModal";
import { emptyQuestion, GOOD_PER_LEVEL, MIN_PER_LEVEL, PLACEMENT_LEVELS } from "../placement/meta";

const KEY = ["placement-grammar"];

export function PlacementPage() {
  const queryClient = useQueryClient();
  const questions = useQuery({ queryKey: KEY, queryFn: api.placementGrammar });
  const lessons = useQuery({ queryKey: ["grammar"], queryFn: api.grammarLessons });
  const [level, setLevel] = useState<PlacementLevel>("A1");
  const [editing, setEditing] = useState<PlacementGrammarQuestion | "new" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      const [data, { datedName, downloadJson }] = await Promise.all([api.exportPlacementGrammar(), import("../sheets")]);
      downloadJson(data, `${datedName("4ume-kiem-tra-dau-vao")}.json`);
      notifySaved(`Đã xuất ${data.length} câu`);
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  }

  const all = questions.data ?? [];
  const lessonList = lessons.data ?? [];
  const list = all.filter((q) => q.level === level);
  const liveCount = (l: PlacementLevel) => all.filter((q) => q.level === l && q.published).length;
  const titleOf = (slug: string | null) => lessonList.find((l) => l.slug === slug)?.titleVi ?? slug;
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  async function save(q: PlacementGrammarInput) {
    if (editing && editing !== "new") await api.updatePlacementGrammar(editing.id, q);
    else await api.createPlacementGrammar(q);
    notifySaved("Đã lưu câu hỏi");
    refresh();
  }

  async function addDrafted(qs: PlacementGrammarInput[]) {
    const { created } = await api.createPlacementGrammarBatch(qs);
    notifySaved(`Đã lưu ${created} câu`);
    refresh();
  }

  async function togglePublished(q: PlacementGrammarQuestion) {
    try {
      await api.updatePlacementGrammar(q.id, { ...q, published: !q.published });
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  async function remove(q: PlacementGrammarQuestion) {
    if (!window.confirm(`Xoá câu "${q.prompt}"?`)) return;
    try {
      await api.deletePlacementGrammar(q.id);
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  const live = liveCount(level);
  const initial = useMemo(() => (editing && editing !== "new" ? editing : emptyQuestion(level)), [editing, level]);

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Kiểm tra đầu vào · Ngữ pháp</Title>
          <Text c="dimmed" fz="sm">
            App hỏi {MIN_PER_LEVEL} câu ngẫu nhiên mỗi cấp, sau phần từ vựng. Câu sai gợi ý bài ngữ pháp nên bắt đầu.
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Menu position="bottom-end" width={220}>
            <Menu.Target>
              <ActionIcon variant="default" size={36} radius="md" loading={exporting} aria-label="Nhập / Xuất JSON">
                <IconFileCode size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUpload size={16} />} onClick={() => setImporting(true)}>
                Nhập từ file JSON
              </Menu.Item>
              <Menu.Item leftSection={<IconDownload size={16} />} onClick={exportAll}>
                Xuất tất cả câu (JSON)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="light" color="grape" leftSection={<IconSparkles size={18} />} onClick={() => setDrafting(true)}>
            AI soạn
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing("new")}>
            Thêm câu
          </Button>
        </Group>
      </Group>

      <PlacementImportModal opened={importing} onClose={() => setImporting(false)} />

      <Paper p="sm" radius="lg" shadow="xs">
        <SegmentedControl
          fullWidth
          value={level}
          onChange={(v) => setLevel(v as PlacementLevel)}
          data={PLACEMENT_LEVELS.map((l) => ({ value: l, label: `${l} · ${liveCount(l)}` }))}
        />
      </Paper>

      {questions.isSuccess && live < MIN_PER_LEVEL ? (
        <Alert color="yellow">
          Cấp {level} mới có {live} câu đang dùng — cần ít nhất {MIN_PER_LEVEL} thì app mới hỏi ngữ pháp ở cấp này.
        </Alert>
      ) : questions.isSuccess && live < GOOD_PER_LEVEL ? (
        <Text fz="sm" c="dimmed">
          Nên có khoảng {GOOD_PER_LEVEL} câu mỗi cấp để người làm lại bài ít gặp câu cũ.
        </Text>
      ) : null}

      {questions.error ? <Alert color="red">{(questions.error as Error).message}</Alert> : null}
      {questions.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {list.map((q) => (
          <Paper key={q.id} p="sm" radius="lg" shadow="xs" style={{ opacity: q.published ? 1 : 0.6 }}>
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600}>{q.prompt}</Text>
                <Group gap={6}>
                  {q.options.map((o) => (
                    <Badge key={o} variant={o === q.answer ? "filled" : "outline"} color={o === q.answer ? "teal" : "gray"} tt="none">
                      {o}
                    </Badge>
                  ))}
                </Group>
                {q.lessonSlug ? (
                  <Text fz="xs" c="dimmed">
                    Bài: {titleOf(q.lessonSlug)}
                  </Text>
                ) : (
                  <Text fz="xs" c="orange.8">
                    Chưa gắn bài ngữ pháp
                  </Text>
                )}
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Tooltip label={q.published ? "Đang dùng" : "Đang ẩn"}>
                  <div>
                    <Switch size="sm" checked={q.published} onChange={() => togglePublished(q)} aria-label="Dùng trong bài kiểm tra" />
                  </div>
                </Tooltip>
                <ActionIcon variant="subtle" onClick={() => setEditing(q)} aria-label="Sửa">
                  <IconPencil size={18} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={() => remove(q)} aria-label="Xoá">
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Group>
          </Paper>
        ))}
        {questions.isSuccess && list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Chưa có câu nào cho cấp {level}. Bấm <b>AI soạn</b> để có nháp nhanh.
          </Text>
        ) : null}
      </Stack>

      <PlacementQuestionModal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm câu hỏi" : "Sửa câu hỏi"}
        initial={initial}
        lessons={lessonList}
        onSave={save}
      />
      <PlacementDraftModal opened={drafting} onClose={() => setDrafting(false)} level={level} lessons={lessonList} onAdd={addDrafted} />
    </Stack>
  );
}
