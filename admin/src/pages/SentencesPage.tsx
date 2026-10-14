import { ActionIcon, Alert, Badge, Button, Group, Menu, Paper, Progress, SegmentedControl, Skeleton, Stack, Switch, Text, TextInput, Title, Tooltip } from "@mantine/core";
import {
  IconDownload,
  IconFileCode,
  IconMicrophone,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mediaSrc, type PlacementLevel, type PracticeSentence, type SentenceInput } from "../api";
import { notifyError, notifySaved } from "../lib";
import { PLACEMENT_LEVELS } from "../placement/meta";
import { PracticeAccessCard } from "../sentences/PracticeAccessCard";
import { SentenceDraftModal } from "../sentences/SentenceDraftModal";
import { SentenceImportModal } from "../sentences/SentenceImportModal";
import { SentenceModal } from "../sentences/SentenceModal";

const KEY = ["sentences"];
const AUDIO_KEY = ["sentence-audio"];
/** Must match PracticeRules.RoundSize: a level with fewer sentences gives a shorter round. */
const ROUND_SIZE = 10;
const GOOD_PER_LEVEL = 50;

const emptySentence = (level: PlacementLevel): SentenceInput => ({ level, topic: "", en: "", vi: "", published: true });

export function SentencesPage() {
  const queryClient = useQueryClient();
  const sentences = useQuery({ queryKey: KEY, queryFn: api.sentences });
  const audio = useQuery({
    queryKey: AUDIO_KEY,
    queryFn: api.sentenceAudio,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  });
  const [level, setLevel] = useState<PlacementLevel>("A1");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PracticeSentence | "new" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [starting, setStarting] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);

  const running = audio.data?.running ?? false;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) queryClient.invalidateQueries({ queryKey: KEY });
    wasRunning.current = running;
  }, [running, queryClient]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: KEY });
    queryClient.invalidateQueries({ queryKey: AUDIO_KEY });
  };

  async function exportAll() {
    setExporting(true);
    try {
      const [data, { datedName, downloadJson }] = await Promise.all([api.exportSentences(), import("../sheets")]);
      downloadJson(data, `${datedName("4ume-luyen-cau")}.json`);
      notifySaved(`Đã xuất ${data.length} câu`);
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  }

  async function startAudio() {
    setStarting(true);
    try {
      queryClient.setQueryData(AUDIO_KEY, await api.startSentenceAudio());
    } catch (e) {
      notifyError(e);
    } finally {
      setStarting(false);
    }
  }

  function play(url: string) {
    player.current?.pause();
    player.current = new Audio(mediaSrc(url));
    player.current.play().catch(notifyError);
  }

  const all = sentences.data ?? [];
  const needle = search.trim().toLowerCase();
  const list = all.filter(
    (s) => s.level === level && (!needle || s.en.toLowerCase().includes(needle) || s.vi.toLowerCase().includes(needle) || s.topic.includes(needle)),
  );
  const liveCount = (l: PlacementLevel) => all.filter((s) => s.level === l && s.published).length;

  async function save(s: SentenceInput) {
    if (editing && editing !== "new") await api.updateSentence(editing.id, s);
    else await api.createSentence(s);
    notifySaved("Đã lưu câu");
    refresh();
  }

  async function addDrafted(items: SentenceInput[]) {
    const { created } = await api.createSentenceBatch(items);
    notifySaved(`Đã lưu ${created} câu`);
    refresh();
  }

  async function togglePublished(s: PracticeSentence) {
    try {
      await api.updateSentence(s.id, { ...s, published: !s.published });
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  async function remove(s: PracticeSentence) {
    if (!window.confirm(`Xoá câu "${s.en}"?`)) return;
    try {
      await api.deleteSentence(s.id);
      refresh();
    } catch (e) {
      notifyError(e);
    }
  }

  const live = liveCount(level);
  const initial = useMemo(() => (editing && editing !== "new" ? editing : emptySentence(level)), [editing, level]);
  const a = audio.data;

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Luyện câu</Title>
          <Text c="dimmed" fz="sm">
            Tab “Luyện” trong app: nghe rồi chép lại hoặc nói lại cả câu. Mỗi lượt {ROUND_SIZE} câu ngẫu nhiên theo cấp độ.
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

      <SentenceImportModal opened={importing} onClose={() => setImporting(false)} />

      <PracticeAccessCard />

      {a ? (
        <Paper p="sm" radius="lg" shadow="xs">
          {running ? (
            <Stack gap={6}>
              <Text fz="sm">
                Đang tạo giọng đọc… {a.done}/{a.total} câu
              </Text>
              <Progress value={a.total ? (a.done / a.total) * 100 : 0} animated />
            </Stack>
          ) : (
            <Group justify="space-between" wrap="nowrap">
              <div>
                <Text fz="sm">
                  {a.missing ? (
                    <>
                      <b>{a.missing}</b> câu đang dùng chưa có giọng đọc (app tạm đọc bằng giọng của điện thoại).
                    </>
                  ) : (
                    "Mọi câu đang dùng đều đã có giọng đọc Azure."
                  )}
                </Text>
                <Text fz="xs" c="dimmed">
                  Azure tháng này: {a.monthChars.toLocaleString("vi-VN")}/{a.monthCharLimit.toLocaleString("vi-VN")} ký tự (dùng chung với bài nghe)
                  {a.configured ? "" : " · máy chủ chưa cấu hình Azure Speech"}
                </Text>
                {a.error ? (
                  <Text fz="xs" c="red.7">
                    Lần trước lỗi: {a.error}
                  </Text>
                ) : null}
              </div>
              <Button
                variant="light"
                leftSection={<IconMicrophone size={18} />}
                onClick={startAudio}
                loading={starting}
                disabled={!a.configured || a.missing === 0}
                style={{ flexShrink: 0 }}
              >
                Tạo giọng đọc
              </Button>
            </Group>
          )}
        </Paper>
      ) : null}

      <Paper p="sm" radius="lg" shadow="xs">
        <Stack gap="sm">
          <SegmentedControl
            fullWidth
            value={level}
            onChange={(v) => setLevel(v as PlacementLevel)}
            data={PLACEMENT_LEVELS.map((l) => ({ value: l, label: `${l} · ${liveCount(l)}` }))}
          />
          <TextInput
            leftSection={<IconSearch size={16} />}
            placeholder="Tìm theo câu, nghĩa hoặc chủ đề"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </Stack>
      </Paper>

      {sentences.isSuccess && live < ROUND_SIZE ? (
        <Alert color="yellow">
          Cấp {level} mới có {live} câu đang dùng — cần ít nhất {ROUND_SIZE} câu cho đủ một lượt luyện.
        </Alert>
      ) : sentences.isSuccess && live < GOOD_PER_LEVEL ? (
        <Text fz="sm" c="dimmed">
          Nên có khoảng {GOOD_PER_LEVEL} câu mỗi cấp để người luyện nhiều lượt ít gặp lại câu cũ.
        </Text>
      ) : null}

      {sentences.error ? <Alert color="red">{(sentences.error as Error).message}</Alert> : null}
      {sentences.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {list.map((s) => (
          <Paper key={s.id} p="sm" radius="lg" shadow="xs" style={{ opacity: s.published ? 1 : 0.6 }}>
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Tooltip label={s.audioState === "ready" ? "Nghe giọng đọc" : s.audioState === "stale" ? "Câu đã sửa, giọng đọc cũ" : "Chưa có giọng đọc"}>
                <ActionIcon
                  variant="light"
                  color={s.audioState === "ready" ? "teal" : s.audioState === "stale" ? "orange" : "gray"}
                  disabled={!s.audioUrl}
                  onClick={() => s.audioUrl && play(s.audioUrl)}
                  aria-label="Nghe"
                >
                  <IconPlayerPlay size={16} />
                </ActionIcon>
              </Tooltip>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600}>{s.en}</Text>
                <Text fz="sm" c="dimmed">
                  {s.vi}
                </Text>
                {s.topic ? (
                  <Badge variant="light" size="xs" tt="none" w="fit-content" mt={2}>
                    {s.topic}
                  </Badge>
                ) : null}
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Tooltip label={s.published ? "Đang dùng" : "Đang ẩn"}>
                  <div>
                    <Switch size="sm" checked={s.published} onChange={() => togglePublished(s)} aria-label="Dùng trong app" />
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
        {sentences.isSuccess && list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {needle ? "Không có câu nào khớp." : (
              <>
                Chưa có câu nào cho cấp {level}. Bấm <b>AI soạn</b> để có nháp nhanh.
              </>
            )}
          </Text>
        ) : null}
      </Stack>

      <SentenceModal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm câu" : "Sửa câu"}
        initial={initial}
        hasAudio={editing !== null && editing !== "new" && editing.audioUrl !== null}
        onSave={save}
      />
      <SentenceDraftModal opened={drafting} onClose={() => setDrafting(false)} level={level} onAdd={addDrafted} />
    </Stack>
  );
}
