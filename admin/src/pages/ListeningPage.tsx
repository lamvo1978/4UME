import { ActionIcon, Alert, Badge, Button, Group, Menu, Paper, SegmentedControl, Skeleton, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconDownload, IconFileCode, IconHeart, IconPlus, IconSearch, IconSparkles, IconUpload } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { LEVELS } from "../grammar/meta";
import { notifyError, notifySaved } from "../lib";
import { ListeningDraftModal } from "../listening/ListeningDraftModal";
import { ListeningImportModal } from "../listening/ListeningImportModal";
import { AUDIO_STATE, formatDuration, KINDS, kindLabel } from "../listening/meta";
import { SpeechStatusCard } from "../listening/SpeechStatusCard";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();

export function ListeningPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lessons = useQuery({ queryKey: ["listening"], queryFn: api.listeningLessons });
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [drafting, setDrafting] = useState(false);
  const [kind, setKind] = useState("all");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      const [data, { datedName, downloadJson }] = await Promise.all([api.exportListening(), import("../sheets")]);
      downloadJson(data, `${datedName("4ume-bai-nghe")}.json`);
      notifySaved(`Đã xuất ${data.length} bài`);
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  }

  const all = lessons.data ?? [];
  const filtering = q.trim() !== "" || level !== "all" || kind !== "all";
  const list = all.filter(
    (l) =>
      (level === "all" || l.level === level) &&
      (kind === "all" || l.kind === kind) &&
      (!q.trim() || fold(`${l.titleVi} ${l.titleEn} ${l.slug} ${l.topic ?? ""}`).includes(fold(q.trim()))),
  );
  const needAudio = all.filter((l) => l.published && l.audioState !== "ready").length;

  async function move(index: number, delta: number) {
    const next = [...all];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    queryClient.setQueryData(["listening"], next);
    try {
      await api.reorderListening(next.map((l) => l.slug));
    } catch (e) {
      notifyError(e);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["listening"] });
    }
  }

  return (
    <Stack gap="md" maw={1000}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Bài nghe</Title>
          <Text c="dimmed" fz="sm">
            {all.length} bài · hội thoại, câu chuyện, bản tin cho tab Nghe trong app
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
          <Button variant="light" leftSection={<IconSparkles size={18} />} onClick={() => setDrafting(true)}>
            AI viết nháp
          </Button>
          <Button component={Link} to="/listening/new" leftSection={<IconPlus size={18} />}>
            Thêm bài
          </Button>
        </Group>
      </Group>
      <ListeningImportModal opened={importing} onClose={() => setImporting(false)} />
      <ListeningDraftModal opened={drafting} onClose={() => setDrafting(false)} />

      <SpeechStatusCard needAudio={needAudio} />

      <Paper p="sm" radius="lg" shadow="xs">
        <Stack gap="sm">
          <TextInput type="search" autoComplete="off" placeholder="Tìm bài, chủ đề…" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} />
          <Group gap="sm" wrap="wrap">
            <SegmentedControl value={kind} onChange={setKind} data={[{ value: "all", label: "Mọi loại" }, ...KINDS.map((k) => ({ value: k.value, label: k.label }))]} />
            <SegmentedControl value={level} onChange={setLevel} data={[{ value: "all", label: "Tất cả" }, ...LEVELS.map((l) => ({ value: l, label: l }))]} />
          </Group>
        </Stack>
      </Paper>

      {lessons.error ? <Alert color="red">{(lessons.error as Error).message}</Alert> : null}
      {lessons.isLoading ? <Skeleton h={300} radius="lg" /> : null}

      <Stack gap={8}>
        {list.map((l) => {
          const index = all.indexOf(l);
          const audio = AUDIO_STATE[l.audioState];
          return (
            <Paper
              key={l.slug}
              p="sm"
              radius="lg"
              shadow="xs"
              style={{ cursor: "pointer", opacity: l.published ? 1 : 0.65 }}
              onClick={() => navigate(`/listening/${l.slug}`)}
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
                    {l.titleEn} · {kindLabel(l.kind)} · {l.lineCount} câu · {formatDuration(l.durationMs)}
                    {l.listeners ? ` · ${l.listeners} người nghe` : ""}
                  </Text>
                </div>
                <Group gap={6} wrap="nowrap">
                  {l.likes ? (
                    <Tooltip label={`${l.likes} người thích`}>
                      <Badge size="sm" color="pink" variant="light" leftSection={<IconHeart size={12} />} visibleFrom="sm">
                        {l.likes}
                      </Badge>
                    </Tooltip>
                  ) : null}
                  <Badge size="sm" color={audio.color} variant="light">
                    {audio.label}
                  </Badge>
                  {l.published ? null : (
                    <Badge size="sm" color="gray" variant="filled">
                      Đã ẩn
                    </Badge>
                  )}
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
