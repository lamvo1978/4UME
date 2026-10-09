import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Chip,
  Grid,
  Group,
  Input,
  List,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconDownload,
  IconHistory,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type GrammarExercise, type GrammarLesson } from "../api";
import { ExerciseEditor } from "../grammar/ExerciseEditor";
import { ExercisePreview } from "../grammar/ExercisePreview";
import {
  cleanLesson,
  displayAnswer,
  EMPTY_LESSON,
  EXERCISE_TYPES,
  exerciseMeta,
  groupProblems,
  LEVELS,
  move,
  newExercise,
  newSection,
  nextExerciseId,
  SECTION_TYPES,
  sectionLabel,
} from "../grammar/meta";
import { SectionBodyEditor, SectionCard } from "../grammar/SectionEditor";
import { TheoryPreview } from "../grammar/TheoryPreview";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { notifyError, notifySaved } from "../lib";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function GrammarEditPage() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const desktop = useMediaQuery("(min-width: 64em)", true);

  const existing = useQuery({ queryKey: ["grammar", slug], queryFn: () => api.grammarLesson(slug!), enabled: !isNew });
  const initial = useMemo<GrammarLesson | null>(() => (isNew ? EMPTY_LESSON : (existing.data?.lesson ?? null)), [isNew, existing.data]);

  const [form, setForm] = useState<GrammarLesson | null>(null);
  const [tab, setTab] = useState<string | null>("info");
  const [selected, setSelected] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
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
    queryKey: ["grammar-validate", debounced],
    queryFn: () => api.validateGrammar(cleanLesson(debounced!)),
    enabled: debounced !== null,
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });
  const problems = validation.data?.problems ?? existing.data?.problems ?? [];
  const grouped = useMemo(() => groupProblems(problems), [problems]);

  if (!isNew && existing.error)
    return (
      <Stack maw={600}>
        <Alert color="red">{(existing.error as Error).message}</Alert>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/grammar")}>
          Về danh sách bài
        </Button>
      </Stack>
    );
  if (!form) return <Loader />;

  const set = (patch: Partial<GrammarLesson>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const learners = existing.data?.learners ?? 0;
  const selectedExercise = form.exercises.find((e) => e.id === selected) ?? null;
  const pool = form.quizSize ?? 8;

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
      const saved = isNew ? await api.createGrammar(body) : await api.updateGrammar(slug!, body);
      queryClient.setQueryData(["grammar", saved.lesson.slug], saved);
      queryClient.invalidateQueries({ queryKey: ["grammar"], exact: true });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      setForm(structuredClone(saved.lesson));
      notifySaved(isNew ? "Đã tạo bài" : `Đã lưu (phiên bản ${saved.lesson.version})`);
      if (isNew) navigate(`/grammar/${saved.lesson.slug}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.deleteGrammar(slug!);
      queryClient.invalidateQueries({ queryKey: ["grammar"], exact: true });
      notifySaved("Đã xoá bài");
      navigate("/grammar", { replace: true });
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

  const setExercise = (id: string, next: GrammarExercise) => {
    set({ exercises: form.exercises.map((e) => (e.id === id ? next : e)) });
    if (next.id !== id) setSelected(next.id);
  };
  const addExercise = (type: string) => {
    const ex = newExercise(type, nextExerciseId(form));
    set({ exercises: [...form.exercises, ex] });
    setSelected(ex.id);
    setTypeFilter("all");
  };

  // ---------- panels ----------

  const infoPanel = (
    <Paper p={{ base: "md", sm: "lg" }} radius="lg" shadow="xs">
      <Stack>
        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Tên bài (tiếng Việt)"
              required
              value={form.titleVi}
              onChange={(e) => set({ titleVi: e.currentTarget.value })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Tên tiếng Anh"
              placeholder="Present continuous"
              value={form.titleEn ?? ""}
              onChange={(e) => {
                const titleEn = e.currentTarget.value;
                set(isNew && !slugTouched ? { titleEn, slug: slugify(titleEn) } : { titleEn });
              }}
            />
          </Grid.Col>
        </Grid>
        <TextInput
          label="Mã bài (slug)"
          required
          disabled={!isNew}
          description={isNew ? "Chữ thường, số, gạch nối. Không đổi được sau khi tạo (kết quả học gắn với mã này)." : undefined}
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set({ slug: slugify(e.currentTarget.value) });
          }}
        />
        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <Input.Wrapper label="Cấp độ">
              <SegmentedControl fullWidth data={LEVELS} value={form.level} onChange={(level) => set({ level })} />
            </Input.Wrapper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <NumberInput
              label="Số câu mỗi lượt luyện"
              min={1}
              max={30}
              value={pool}
              onChange={(v) => set({ quizSize: typeof v === "number" ? v : 8 })}
            />
          </Grid.Col>
        </Grid>
        <Textarea
          label="Tóm tắt"
          required
          autosize
          minRows={2}
          description="1–2 câu, hiện dưới tên bài"
          value={form.summaryVi}
          onChange={(e) => set({ summaryVi: e.currentTarget.value })}
        />
        <Switch
          size="md"
          label="Hiện trong app"
          description="Bài bị ẩn không hiện trong lộ trình và lịch ôn. Tắt để lưu nháp khi bài chưa hoàn chỉnh."
          checked={form.published !== false}
          onChange={(e) => set({ published: e.currentTarget.checked })}
        />
      </Stack>
    </Paper>
  );

  const theoryPanel = (
    <Stack gap="sm">
      {form.sections.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">
          Chưa có khối lý thuyết nào.
        </Text>
      ) : null}
      {form.sections.map((s, i) => (
        <SectionCard
          key={i}
          index={i}
          count={form.sections.length}
          problems={grouped.sections.get(i)}
          onMove={(d) => set({ sections: move(form.sections, i, d) })}
          onRemove={() => window.confirm(`Xoá khối "${s.title || sectionLabel(s.type)}"?`) && set({ sections: form.sections.filter((_, j) => j !== i) })}
          badge={
            <Badge variant="light" radius="sm" style={{ flexShrink: 0 }}>
              {sectionLabel(s.type)}
            </Badge>
          }
          title={
            <TextInput
              variant="unstyled"
              size="sm"
              style={{ flex: 1 }}
              placeholder={`Tiêu đề (mặc định: ${sectionLabel(s.type)})`}
              value={s.title ?? ""}
              onChange={(e) => set({ sections: form.sections.map((x, j) => (j === i ? { ...x, title: e.currentTarget.value } : x)) })}
              styles={{ input: { fontWeight: 700 } }}
            />
          }
        >
          <SectionBodyEditor section={s} onChange={(next) => set({ sections: form.sections.map((x, j) => (j === i ? next : x)) })} />
        </SectionCard>
      ))}
      <AddMenu
        label="Thêm khối lý thuyết"
        items={SECTION_TYPES.map((t) => ({ value: t.type, label: t.label, hint: t.hint }))}
        onPick={(type) => set({ sections: [...form.sections, newSection(type)] })}
      />
    </Stack>
  );

  const counts = EXERCISE_TYPES.map((t) => ({ ...t, count: form.exercises.filter((e) => e.type === t.type).length }));
  const visible = form.exercises.filter((e) => typeFilter === "all" || e.type === typeFilter);

  const exercisesPanel = (
    <Stack gap="sm">
      {form.exercises.length < pool + 4 ? (
        <Alert color="orange" icon={<IconAlertTriangle size={18} />} radius="lg">
          Có {form.exercises.length} câu; nên có ít nhất {pool + 4} câu (số câu mỗi lượt + 4) để mỗi lần luyện tập khác nhau.
        </Alert>
      ) : null}
      <Chip.Group value={typeFilter} onChange={(v) => setTypeFilter(v as string)}>
        <Group gap={6}>
          {[{ value: "all", label: `Tất cả (${form.exercises.length})` }, ...counts.map((c) => ({ value: c.type, label: `${c.label} (${c.count})` }))].map((o) => (
            <Chip key={o.value} value={o.value} size="sm" variant="light">
              {o.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      {visible.map((ex) => {
        const index = form.exercises.indexOf(ex);
        const meta = exerciseMeta(ex.type);
        const exProblems = grouped.exercises.get(ex.id);
        const open = ex.id === selected;
        return (
          <Paper
            key={index}
            radius="lg"
            shadow="xs"
            withBorder={open || !!exProblems}
            style={{ borderColor: exProblems ? "#F08C00" : open ? "#0F6B5C" : undefined, overflow: "hidden" }}
          >
            <UnstyledButton w="100%" p="sm" onClick={() => setSelected(open ? null : ex.id)}>
              <Group gap="sm" wrap="nowrap">
                <Badge variant="light" color={meta.color} w={110} style={{ flexShrink: 0 }}>
                  {meta.label}
                </Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fz="sm" fw={600} truncate>
                    {ex.prompt || ex.promptVi || ex.source || ex.sentence || "(chưa có nội dung)"}
                  </Text>
                  <Text fz="xs" c="dimmed" truncate>
                    {ex.id} · {displayAnswer(ex) || "—"}
                  </Text>
                </div>
                {exProblems ? <IconAlertTriangle size={18} color="#F08C00" /> : null}
              </Group>
            </UnstyledButton>
            {open ? (
              <Stack p="sm" pt={0} gap="sm">
                {exProblems ? (
                  <Text fz="sm" c="orange.8">
                    {exProblems.join(" ")}
                  </Text>
                ) : null}
                <ExerciseEditor exercise={ex} onChange={(next) => setExercise(ex.id, next)} />
                <Group justify="space-between">
                  <Group gap={4}>
                    <ActionIcon variant="light" disabled={index === 0} onClick={() => set({ exercises: move(form.exercises, index, -1) })} aria-label="Lên">
                      <IconArrowUp size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light" disabled={index === form.exercises.length - 1} onClick={() => set({ exercises: move(form.exercises, index, 1) })} aria-label="Xuống">
                      <IconArrowDown size={16} />
                    </ActionIcon>
                  </Group>
                  <Group gap={6}>
                    <Button
                      variant="default"
                      size="sm"
                      leftSection={<IconCopy size={16} />}
                      onClick={() => {
                        const copy = { ...structuredClone(ex), id: nextExerciseId(form) };
                        set({ exercises: [...form.exercises.slice(0, index + 1), copy, ...form.exercises.slice(index + 1)] });
                        setSelected(copy.id);
                      }}
                    >
                      Nhân bản
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      leftSection={<IconTrash size={16} color="var(--mantine-color-red-6)" />}
                      onClick={() => window.confirm(`Xoá câu ${ex.id}?`) && set({ exercises: form.exercises.filter((_, j) => j !== index) })}
                    >
                      Xoá câu
                    </Button>
                  </Group>
                </Group>
              </Stack>
            ) : null}
          </Paper>
        );
      })}
      <AddMenu
        label="Thêm câu bài tập"
        items={EXERCISE_TYPES.map((t) => ({ value: t.type, label: t.label, hint: t.hint }))}
        onPick={addExercise}
      />
    </Stack>
  );

  const exercisePreview = selectedExercise ? (
    <ExercisePreview key={JSON.stringify(selectedExercise)} exercise={selectedExercise} />
  ) : (
    <Paper radius={20} p="lg" bg="white">
      <Text c="dimmed" ta="center">
        Chọn một câu bên trái để làm thử như trên app.
      </Text>
    </Paper>
  );

  const preview =
    tab === "exercises" ? (
      exercisePreview
    ) : (
      <TheoryPreview lesson={cleanLesson(form)} />
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

  const actions = desktop ? (
    <>
      {!isNew ? (
        <Button variant="default" leftSection={<IconHistory size={18} />} onClick={() => setHistoryOpen(true)}>
          Lịch sử
        </Button>
      ) : null}
      {!isNew ? (
        <Button variant="default" leftSection={<IconDownload size={18} />} onClick={download}>
          JSON
        </Button>
      ) : null}
      {!isNew ? (
        <Button variant="default" leftSection={<IconTrash size={18} color="var(--mantine-color-red-6)" />} onClick={() => setConfirmDelete(true)}>
          Xoá
        </Button>
      ) : null}
      {saveButton}
    </>
  ) : (
    <>
      {!isNew ? (
        <ActionIcon variant="default" size={42} radius="md" onClick={() => setHistoryOpen(true)} aria-label="Lịch sử">
          <IconHistory size={20} />
        </ActionIcon>
      ) : null}
      {!isNew ? (
        <ActionIcon variant="default" size={42} radius="md" onClick={download} aria-label="Tải JSON">
          <IconDownload size={20} />
        </ActionIcon>
      ) : null}
      {!isNew ? (
        <ActionIcon variant="default" size={42} radius="md" onClick={() => setConfirmDelete(true)} aria-label="Xoá">
          <IconTrash size={20} color="var(--mantine-color-red-6)" />
        </ActionIcon>
      ) : null}
      {saveButton}
    </>
  );

  const tabs = (
    <Tabs.List mb="sm">
      <Tabs.Tab value="info">Thông tin</Tabs.Tab>
      <Tabs.Tab value="theory" rightSection={<CountBadge n={form.sections.length} warn={grouped.sections.size > 0} />}>
        Lý thuyết
      </Tabs.Tab>
      <Tabs.Tab value="exercises" rightSection={<CountBadge n={form.exercises.length} warn={grouped.exercises.size > 0} />}>
        Bài tập
      </Tabs.Tab>
      {!desktop ? <Tabs.Tab value="preview">Xem trước</Tabs.Tab> : null}
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
              {isNew ? "Thêm bài ngữ pháp" : form.titleVi || slug}
            </Title>
            {!isNew ? (
              <Text fz="xs" c="dimmed">
                Mã: {slug} · phiên bản {form.version} · {learners > 0 ? `${learners} người đã học` : "chưa ai học"}
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
          {problems.length > 6 ? <Text fz="sm">… và {problems.length - 6} chỗ khác (xem đánh dấu cam trong từng tab).</Text> : null}
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
              <Tabs.Panel value="info">{infoPanel}</Tabs.Panel>
              <Tabs.Panel value="theory">{theoryPanel}</Tabs.Panel>
              <Tabs.Panel value="exercises">{exercisesPanel}</Tabs.Panel>
            </Grid.Col>
            <Grid.Col span={5} style={{ position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
              <Text fw={700} fz="sm" tt="uppercase" c="dimmed" mb="sm">
                {tab === "exercises" ? "Làm thử câu đang chọn" : "Xem trước trên app"}
              </Text>
              {preview}
            </Grid.Col>
          </Grid>
        ) : (
          <>
            {tabs}
            <Tabs.Panel value="info">{infoPanel}</Tabs.Panel>
            <Tabs.Panel value="theory">{theoryPanel}</Tabs.Panel>
            <Tabs.Panel value="exercises">{exercisesPanel}</Tabs.Panel>
            <Tabs.Panel value="preview">
              <Stack>
                <TheoryPreview lesson={cleanLesson(form)} />
                {selectedExercise ? exercisePreview : null}
              </Stack>
            </Tabs.Panel>
          </>
        )}
      </Tabs>

      {!desktop ? (
        <Paper shadow="md" p="sm" style={{ position: "fixed", left: 0, right: 0, bottom: 64, zIndex: 50, borderRadius: 0 }}>
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      {!isNew ? (
        <HistoryDrawer
          opened={historyOpen}
          onClose={() => setHistoryOpen(false)}
          entityType="grammar"
          entityId={slug!}
          title={existing.data?.lesson.titleVi ?? slug!}
          onRestored={() => setHistoryOpen(false)}
        />
      ) : null}

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Xoá bài này?">
        {learners > 0 ? (
          <Stack>
            <Text>
              Đã có <b>{learners}</b> người học bài này nên không xoá được (sẽ mất kết quả và lịch ôn của họ).
            </Text>
            <Text>
              Hãy tắt <b>Hiện trong app</b> ở tab Thông tin rồi lưu để ẩn bài.
            </Text>
          </Stack>
        ) : (
          <Stack>
            <Text>Bài "{existing.data?.lesson.titleVi}" sẽ bị xoá vĩnh viễn. Chưa ai học bài này.</Text>
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

function CountBadge({ n, warn }: { n: number; warn: boolean }) {
  return (
    <Badge size="sm" circle={n < 10} style={{ flexShrink: 0, overflow: "visible" }} variant={warn ? "filled" : "light"} color={warn ? "orange" : "gray"}>
      {n}
    </Badge>
  );
}

function AddMenu({ label, items, onPick }: { label: string; items: { value: string; label: string; hint: string }[]; onPick: (v: string) => void }) {
  return (
    <Menu position="bottom-start" width={300} shadow="md">
      <Menu.Target>
        <Button variant="light" leftSection={<IconPlus size={18} />} style={{ alignSelf: "flex-start" }}>
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((it) => (
          <Menu.Item key={it.value} onClick={() => onPick(it.value)}>
            <Text fw={600} fz="sm">
              {it.label}
            </Text>
            <Text fz="xs" c="dimmed">
              {it.hint}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
