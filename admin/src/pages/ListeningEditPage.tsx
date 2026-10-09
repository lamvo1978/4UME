import { ActionIcon, Alert, Button, Grid, Group, Input, List, Loader, Modal, Paper, SegmentedControl, Stack, Switch, Tabs, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconAlertTriangle, IconArrowLeft, IconCheck, IconDeviceFloppy, IconDownload, IconHistory, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type ListeningKind, type ListeningLesson } from "../api";
import { LEVELS } from "../grammar/meta";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { mobileActionBarStyle } from "../layout/mobileActionBar";
import { notifyError, notifySaved } from "../lib";
import { AudioPanel } from "../listening/AudioPanel";
import { cleanLesson, EMPTY_LESSON, KINDS } from "../listening/meta";
import { LinesEditor, SpeakersEditor } from "../listening/ScriptEditor";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** "Câu 3: …" problems keyed by line index, so each line can show its own. */
function lineProblems(problems: string[]) {
  const map = new Map<number, string[]>();
  for (const p of problems) {
    const m = /^Câu (\d+): (.+)$/.exec(p);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    map.set(i, [...(map.get(i) ?? []), m[2]]);
  }
  return map;
}

export function ListeningEditPage() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const desktop = useMediaQuery("(min-width: 64em)", true);

  const existing = useQuery({
    queryKey: ["listening", slug],
    queryFn: () => api.listeningLesson(slug!),
    enabled: !isNew,
    refetchInterval: (q) => (q.state.data?.audio.state === "running" ? 2000 : false),
  });
  const speech = useQuery({ queryKey: ["speech-status"], queryFn: api.speechStatus, staleTime: 30_000 });
  // Polling returns a new object each time; keying on the JSON keeps unsaved edits while audio is generated.
  const initialJson = isNew ? JSON.stringify(EMPTY_LESSON) : existing.data ? JSON.stringify(existing.data.lesson) : null;
  const initial = useMemo<ListeningLesson | null>(() => (initialJson ? JSON.parse(initialJson) : null), [initialJson]);

  const [form, setForm] = useState<ListeningLesson | null>(null);
  const [tab, setTab] = useState<string | null>("script");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (initial) setForm(structuredClone(initial));
  }, [initial]);

  const dirty = form !== null && initial !== null && JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const [debounced] = useDebouncedValue(form, 600);
  const validation = useQuery({
    queryKey: ["listening-validate", debounced],
    queryFn: () => api.validateListening(cleanLesson(debounced!)),
    enabled: debounced !== null,
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });
  const problems = validation.data?.problems ?? existing.data?.problems ?? [];
  const perLine = useMemo(() => lineProblems(problems), [problems]);

  if (!isNew && existing.error)
    return (
      <Stack maw={600}>
        <Alert color="red">{(existing.error as Error).message}</Alert>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/listening")}>
          Về danh sách bài
        </Button>
      </Stack>
    );
  if (!form) return <Loader />;

  const set = (patch: Partial<ListeningLesson>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const listeners = existing.data?.listeners ?? 0;

  function back() {
    if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang?")) return;
    navigate(-1);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const body = cleanLesson(form);
      const saved = isNew ? await api.createListening(body) : await api.updateListening(slug!, body);
      queryClient.setQueryData(["listening", saved.lesson.slug], saved);
      queryClient.invalidateQueries({ queryKey: ["listening"], exact: true });
      setForm(structuredClone(saved.lesson));
      notifySaved(isNew ? "Đã tạo bài" : `Đã lưu (phiên bản ${saved.lesson.version})`);
      if (isNew) navigate(`/listening/${saved.lesson.slug}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.deleteListening(slug!);
      queryClient.invalidateQueries({ queryKey: ["listening"], exact: true });
      notifySaved("Đã xoá bài");
      navigate("/listening", { replace: true });
    } catch (e) {
      notifyError(e);
    } finally {
      setConfirmDelete(false);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(cleanLesson(form!), null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${String(form!.order).padStart(2, "0")}-${form!.slug || "bai-moi"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const infoPanel = (
    <Paper p={{ base: "md", sm: "lg" }} radius="lg" shadow="xs">
      <Stack>
        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Tên tiếng Anh"
              required
              placeholder="At the Café"
              value={form.titleEn}
              onChange={(e) => {
                const titleEn = e.currentTarget.value;
                set(isNew && !slugTouched ? { titleEn, slug: slugify(titleEn) } : { titleEn });
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Tên tiếng Việt" required value={form.titleVi} onChange={(e) => set({ titleVi: e.currentTarget.value })} />
          </Grid.Col>
        </Grid>
        <TextInput
          label="Mã bài (slug)"
          required
          disabled={!isNew}
          description={isNew ? "Chữ thường, số, gạch nối. Không đổi được sau khi tạo (tiến độ nghe gắn với mã này)." : undefined}
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set({ slug: slugify(e.currentTarget.value) });
          }}
        />
        <Input.Wrapper label="Thể loại">
          <SegmentedControl fullWidth data={KINDS.map((k) => ({ value: k.value, label: k.label }))} value={form.kind} onChange={(kind) => set({ kind: kind as ListeningKind })} />
        </Input.Wrapper>
        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <Input.Wrapper label="Cấp độ" description="A1 đọc chậm hơn khoảng 15%, A2 chậm hơn 8%">
              <SegmentedControl fullWidth data={LEVELS} value={form.level} onChange={(level) => set({ level })} />
            </Input.Wrapper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <TextInput label="Chủ đề" placeholder="Du lịch, Công việc…" value={form.topic ?? ""} onChange={(e) => set({ topic: e.currentTarget.value })} />
          </Grid.Col>
        </Grid>
        <Textarea
          label="Tóm tắt"
          required
          autosize
          minRows={2}
          description="1–2 câu tiếng Việt, hiện dưới tên bài"
          value={form.summaryVi}
          onChange={(e) => set({ summaryVi: e.currentTarget.value })}
        />
        <Switch
          size="md"
          label="Hiện trong app"
          description="Tắt để lưu nháp khi bài chưa hoàn chỉnh."
          checked={form.published !== false}
          onChange={(e) => set({ published: e.currentTarget.checked })}
        />
      </Stack>
    </Paper>
  );

  const scriptPanel = (
    <Stack gap="sm">
      <SpeakersEditor lesson={form} voices={speech.data?.voices ?? []} canPreview={!!speech.data?.configured} onChange={set} />
      <LinesEditor lesson={form} onChange={set} problems={perLine} />
    </Stack>
  );

  const audioPanel = (
    <AudioPanel
      lesson={form}
      detail={existing.data}
      dirty={dirty}
      configured={!!speech.data?.configured}
      onStarted={() => {
        queryClient.invalidateQueries({ queryKey: ["listening", slug] });
        queryClient.invalidateQueries({ queryKey: ["speech-status"] });
      }}
    />
  );

  const saveButton =
    dirty || isNew ? (
      <Button miw={140} flex={desktop ? undefined : 1} leftSection={<IconDeviceFloppy size={18} />} onClick={save} loading={saving}>
        {isNew ? "Tạo bài" : "Lưu thay đổi"}
      </Button>
    ) : (
      <Button miw={140} flex={desktop ? undefined : 1} variant="light" leftSection={<IconCheck size={18} />} style={{ cursor: "default" }}>
        Đã lưu
      </Button>
    );

  const actions = (
    <>
      {!isNew ? (
        desktop ? (
          <Button variant="default" leftSection={<IconHistory size={18} />} onClick={() => setHistoryOpen(true)}>
            Lịch sử
          </Button>
        ) : (
          <ActionIcon variant="default" size={42} radius="md" onClick={() => setHistoryOpen(true)} aria-label="Lịch sử">
            <IconHistory size={20} />
          </ActionIcon>
        )
      ) : null}
      {!isNew ? (
        desktop ? (
          <Button variant="default" leftSection={<IconDownload size={18} />} onClick={download}>
            JSON
          </Button>
        ) : (
          <ActionIcon variant="default" size={42} radius="md" onClick={download} aria-label="Tải JSON">
            <IconDownload size={20} />
          </ActionIcon>
        )
      ) : null}
      {!isNew ? (
        desktop ? (
          <Button variant="default" leftSection={<IconTrash size={18} color="var(--mantine-color-red-6)" />} onClick={() => setConfirmDelete(true)}>
            Xoá
          </Button>
        ) : (
          <ActionIcon variant="default" size={42} radius="md" onClick={() => setConfirmDelete(true)} aria-label="Xoá">
            <IconTrash size={20} color="var(--mantine-color-red-6)" />
          </ActionIcon>
        )
      ) : null}
      {saveButton}
    </>
  );

  const scriptWarn = perLine.size > 0 || problems.some((p) => p.startsWith("Người đọc") || p.startsWith("Cần ít nhất"));
  const tabs = (
    <Tabs.List mb="sm">
      <Tabs.Tab value="script" rightSection={scriptWarn ? <IconAlertTriangle size={14} color="#F08C00" /> : undefined}>
        Script
      </Tabs.Tab>
      <Tabs.Tab value="info">Thông tin</Tabs.Tab>
      {!desktop ? <Tabs.Tab value="audio">Âm thanh</Tabs.Tab> : null}
    </Tabs.List>
  );

  return (
    <Stack gap="md" maw={1300} pb={desktop ? 0 : 80}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon variant="subtle" size="lg" onClick={back} aria-label="Quay lại">
            <IconArrowLeft />
          </ActionIcon>
          <div style={{ minWidth: 0 }}>
            <Title order={2} lineClamp={1}>
              {isNew ? "Thêm bài nghe" : form.titleVi || slug}
            </Title>
            {!isNew ? (
              <Text fz="xs" c="dimmed">
                Mã: {slug} · phiên bản {form.version} · {listeners > 0 ? `${listeners} người nghe, ${existing.data?.completions ?? 0} lượt nghe hết` : "chưa ai nghe"}
                {existing.data?.likes ? ` · ${existing.data.likes} thích` : ""}
              </Text>
            ) : null}
          </div>
        </Group>
        {desktop ? <Group gap="sm" wrap="nowrap">{actions}</Group> : null}
      </Group>

      {error ? (
        <Alert color="red" withCloseButton onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {problems.length > 0 ? (
        <Alert color="orange" icon={<IconAlertTriangle size={18} />} radius="lg" title={`${problems.length} chỗ cần sửa trước khi hiện bài trong app`}>
          <List size="sm" spacing={2}>
            {problems.slice(0, 6).map((p) => (
              <List.Item key={p}>{p}</List.Item>
            ))}
          </List>
          {problems.length > 6 ? <Text fz="sm">… và {problems.length - 6} chỗ khác.</Text> : null}
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        keepMounted={false}
        styles={desktop ? undefined : { list: { flexWrap: "nowrap", overflowX: "auto" }, tab: { paddingInline: 8, flexShrink: 0 } }}
      >
        {desktop ? (
          <Grid gap="lg" align="flex-start">
            <Grid.Col span={7}>
              {tabs}
              <Tabs.Panel value="script">{scriptPanel}</Tabs.Panel>
              <Tabs.Panel value="info">{infoPanel}</Tabs.Panel>
            </Grid.Col>
            <Grid.Col span={5} style={{ position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
              {audioPanel}
            </Grid.Col>
          </Grid>
        ) : (
          <>
            {tabs}
            <Tabs.Panel value="script">{scriptPanel}</Tabs.Panel>
            <Tabs.Panel value="info">{infoPanel}</Tabs.Panel>
            <Tabs.Panel value="audio">{audioPanel}</Tabs.Panel>
          </>
        )}
      </Tabs>

      {!desktop ? (
        <Paper shadow="md" p="sm" style={mobileActionBarStyle}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      {!isNew ? (
        <HistoryDrawer
          opened={historyOpen}
          onClose={() => setHistoryOpen(false)}
          entityType="listening"
          entityId={slug!}
          title={existing.data?.lesson.titleVi ?? slug!}
          onRestored={() => setHistoryOpen(false)}
        />
      ) : null}

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Xoá bài này?">
        {listeners > 0 ? (
          <Stack>
            <Text>
              Đã có <b>{listeners}</b> người nghe bài này nên không xoá được (sẽ mất tiến độ của họ).
            </Text>
            <Text>
              Hãy tắt <b>Hiện trong app</b> ở tab Thông tin rồi lưu để ẩn bài.
            </Text>
          </Stack>
        ) : (
          <Stack>
            <Text>Bài "{existing.data?.lesson.titleVi}" và file âm thanh sẽ bị xoá vĩnh viễn. Chưa ai nghe bài này.</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmDelete(false)}>
                Huỷ
              </Button>
              <Button color="red" onClick={remove}>
                Xoá
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
