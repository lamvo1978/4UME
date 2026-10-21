import { ActionIcon, Alert, Badge, Button, Group, Paper, SegmentedControl, Skeleton, Stack, Switch, Text, Title, Tooltip } from "@mantine/core";
import { IconPencil, IconPlus, IconSparkles, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type ConversationScenario, type PlacementLevel, type ScenarioInput } from "../api";
import { CONVERSATION_CONFIG_KEY, ConversationConfigCard } from "../conversation/ConversationConfigCard";
import { ScenarioDraftModal } from "../conversation/ScenarioDraftModal";
import { ScenarioModal } from "../conversation/ScenarioModal";
import { notifyError, notifySaved } from "../lib";
import { PLACEMENT_LEVELS } from "../placement/meta";

const KEY = ["conversation-scenarios"];

const emptyScenario = (level: PlacementLevel): ScenarioInput => ({
  level,
  titleVi: "",
  icon: "",
  situation: "",
  aiRole: "",
  goalVi: "",
  opening: "",
  keyPhrases: [],
  published: true,
});

export function ConversationPage() {
  const queryClient = useQueryClient();
  const scenarios = useQuery({ queryKey: KEY, queryFn: api.conversationScenarios });
  const config = useQuery({ queryKey: CONVERSATION_CONFIG_KEY, queryFn: api.conversationConfig });
  const [level, setLevel] = useState<PlacementLevel>("A1");
  const [editing, setEditing] = useState<ConversationScenario | "new" | null>(null);
  const [drafting, setDrafting] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const all = scenarios.data ?? [];
  const list = all.filter((s) => s.level === level);
  const liveCount = (l: PlacementLevel) => all.filter((s) => s.level === l && s.published).length;
  const initial = useMemo(() => (editing && editing !== "new" ? editing : emptyScenario(level)), [editing, level]);

  async function save(s: ScenarioInput) {
    if (editing && editing !== "new") await api.updateScenario(editing.id, s);
    else await api.createScenario(s);
    notifySaved("Đã lưu tình huống");
    refresh();
  }

  async function addDrafted(items: ScenarioInput[]) {
    const { created } = await api.createScenarioBatch(items);
    notifySaved(`Đã lưu ${created} tình huống`);
    refresh();
  }

  async function togglePublished(s: ConversationScenario) {
    try {
      await api.updateScenario(s.id, { ...s, published: !s.published });
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  async function remove(s: ConversationScenario) {
    if (!window.confirm(`Xoá tình huống "${s.titleVi}"?`)) return;
    try {
      await api.deleteScenario(s.id);
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Đàm thoại AI</Title>
          <Text c="dimmed" fz="sm">
            Tab “Luyện” trong app → Đàm thoại với AI: nhập vai theo tình huống hoặc trò chuyện tự do. Người học nói (nhận dạng giọng trên máy) hoặc gõ, AI trả lời và
            sửa câu.
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Button variant="light" color="grape" leftSection={<IconSparkles size={18} />} onClick={() => setDrafting(true)}>
            AI soạn
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing("new")}>
            Thêm tình huống
          </Button>
        </Group>
      </Group>

      <ConversationConfigCard />

      <Paper p="sm" radius="lg" shadow="xs">
        <SegmentedControl
          fullWidth
          value={level}
          onChange={(v) => setLevel(v as PlacementLevel)}
          data={PLACEMENT_LEVELS.map((l) => ({ value: l, label: `${l} · ${liveCount(l)}` }))}
        />
      </Paper>

      {scenarios.error ? <Alert color="red">{(scenarios.error as Error).message}</Alert> : null}
      {scenarios.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {list.map((s) => (
          <Paper key={s.id} p="sm" radius="lg" shadow="xs" style={{ opacity: s.published ? 1 : 0.6 }}>
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6}>
                  <Text fw={600}>{s.titleVi}</Text>
                  <Badge variant="light" size="xs" tt="none">
                    {s.aiRole}
                  </Badge>
                  {s.uses ? (
                    <Badge variant="outline" size="xs" tt="none" color="gray">
                      {s.uses} buổi
                    </Badge>
                  ) : null}
                </Group>
                <Text fz="sm">{s.goalVi}</Text>
                <Text fz="sm" c="dimmed" fs="italic">
                  “{s.opening}”
                </Text>
                {s.keyPhrases.length ? (
                  <Text fz="xs" c="dimmed">
                    Gợi ý: {s.keyPhrases.join(" · ")}
                  </Text>
                ) : null}
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Tooltip label={s.published ? "Đang hiện" : "Đang ẩn"}>
                  <div>
                    <Switch size="sm" checked={s.published} onChange={() => togglePublished(s)} aria-label="Hiện trong app" />
                  </div>
                </Tooltip>
                <ActionIcon variant="subtle" onClick={() => setEditing(s)} aria-label="Sửa">
                  <IconPencil size={18} />
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={() => remove(s)} aria-label="Xoá">
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Group>
          </Paper>
        ))}
        {scenarios.isSuccess && list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Chưa có tình huống nào cho cấp {level}. Bấm <b>AI soạn</b> để có nháp nhanh.
          </Text>
        ) : null}
      </Stack>

      <ScenarioModal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm tình huống" : "Sửa tình huống"}
        initial={initial}
        onSave={save}
      />
      <ScenarioDraftModal
        opened={drafting}
        onClose={() => setDrafting(false)}
        level={level}
        providers={config.data?.providers}
        onAdd={addDrafted}
      />
    </Stack>
  );
}
