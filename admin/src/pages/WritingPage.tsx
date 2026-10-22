import { ActionIcon, Alert, Badge, Button, Group, Paper, SegmentedControl, Skeleton, Stack, Switch, Text, Title, Tooltip } from "@mantine/core";
import { IconPencil, IconPlus, IconSparkles, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type PlacementLevel, type WritingPrompt, type WritingPromptInput } from "../api";
import { notifyError, notifySaved } from "../lib";
import { PLACEMENT_LEVELS } from "../placement/meta";
import { WRITING_CONFIG_KEY, WritingConfigCard } from "../writing/WritingConfigCard";
import { WritingPromptDraftModal } from "../writing/WritingPromptDraftModal";
import { WritingPromptModal } from "../writing/WritingPromptModal";
import { WritingTryCard } from "../writing/WritingTryCard";

const KEY = ["writing-prompts"];

const emptyPrompt = (level: PlacementLevel): WritingPromptInput => ({
  level,
  titleVi: "",
  icon: "",
  promptEn: "",
  guideVi: "",
  minWords: 0,
  maxWords: 0,
  keyPhrases: [],
  published: true,
});

export function WritingPage() {
  const queryClient = useQueryClient();
  const prompts = useQuery({ queryKey: KEY, queryFn: api.writingPrompts });
  const config = useQuery({ queryKey: WRITING_CONFIG_KEY, queryFn: api.writingConfig });
  const [level, setLevel] = useState<PlacementLevel>("A1");
  const [editing, setEditing] = useState<WritingPrompt | "new" | null>(null);
  const [drafting, setDrafting] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const all = prompts.data ?? [];
  const list = all.filter((p) => p.level === level);
  const liveCount = (l: PlacementLevel) => all.filter((p) => p.level === l && p.published).length;
  const initial = useMemo(() => (editing && editing !== "new" ? editing : emptyPrompt(level)), [editing, level]);

  async function save(p: WritingPromptInput) {
    if (editing && editing !== "new") await api.updateWritingPrompt(editing.id, p);
    else await api.createWritingPrompt(p);
    notifySaved("Đã lưu đề viết");
    refresh();
  }

  async function addDrafted(items: WritingPromptInput[]) {
    const { created } = await api.createWritingPromptBatch(items);
    notifySaved(`Đã lưu ${created} đề viết`);
    refresh();
  }

  async function togglePublished(p: WritingPrompt) {
    try {
      await api.updateWritingPrompt(p.id, { ...p, published: !p.published });
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  async function remove(p: WritingPrompt) {
    if (!window.confirm(`Xoá đề "${p.titleVi}"? Bài người học đã viết theo đề này vẫn được giữ.`)) return;
    try {
      await api.deleteWritingPrompt(p.id);
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Luyện viết AI</Title>
          <Text c="dimmed" fz="sm">
            Tab “Luyện” trong app → Luyện viết với AI: người học viết một đoạn văn theo đề hoặc viết tự do, AI chấm điểm, tô lỗi, giải thích, viết lại và gợi ý
            nâng cấp.
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Button variant="light" color="grape" leftSection={<IconSparkles size={18} />} onClick={() => setDrafting(true)}>
            AI soạn
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing("new")}>
            Thêm đề
          </Button>
        </Group>
      </Group>

      <WritingConfigCard />
      <WritingTryCard providers={config.data?.providers} />

      <Paper p="sm" radius="lg" shadow="xs">
        <SegmentedControl
          fullWidth
          value={level}
          onChange={(v) => setLevel(v as PlacementLevel)}
          data={PLACEMENT_LEVELS.map((l) => ({ value: l, label: `${l} · ${liveCount(l)}` }))}
        />
      </Paper>

      {prompts.error ? <Alert color="red">{(prompts.error as Error).message}</Alert> : null}
      {prompts.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {list.map((p) => (
          <Paper key={p.id} p="sm" radius="lg" shadow="xs" style={{ opacity: p.published ? 1 : 0.6 }}>
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6}>
                  <Text fw={600}>{p.titleVi}</Text>
                  <Badge variant="light" size="xs" tt="none">
                    {p.minWords || "?"}–{p.maxWords || "?"} từ
                  </Badge>
                  {p.uses ? (
                    <Badge variant="outline" size="xs" tt="none" color="gray">
                      {p.uses} bài
                    </Badge>
                  ) : null}
                </Group>
                <Text fz="sm">{p.promptEn}</Text>
                {p.guideVi ? (
                  <Text fz="sm" c="dimmed">
                    {p.guideVi}
                  </Text>
                ) : null}
                {p.keyPhrases.length ? (
                  <Text fz="xs" c="dimmed">
                    Gợi ý: {p.keyPhrases.join(" · ")}
                  </Text>
                ) : null}
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Tooltip label={p.published ? "Đang hiện" : "Đang ẩn"}>
                  <div>
                    <Switch size="sm" checked={p.published} onChange={() => togglePublished(p)} aria-label="Hiện trong app" />
                  </div>
                </Tooltip>
                <ActionIcon variant="subtle" onClick={() => setEditing(p)} aria-label="Sửa">
                  <IconPencil size={18} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={() => remove(p)} aria-label="Xoá">
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Group>
          </Paper>
        ))}
        {prompts.isSuccess && list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Chưa có đề nào cho cấp {level}. Bấm <b>AI soạn</b> để có nháp nhanh.
          </Text>
        ) : null}
      </Stack>

      <WritingPromptModal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm đề viết" : "Sửa đề viết"}
        initial={initial}
        onSave={save}
      />
      <WritingPromptDraftModal
        opened={drafting}
        onClose={() => setDrafting(false)}
        level={level}
        providers={config.data?.providers}
        onAdd={addDrafted}
      />
    </Stack>
  );
}
