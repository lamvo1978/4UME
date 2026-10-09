import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Grid,
  Group,
  Input,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowLeft, IconCheck, IconDeviceFloppy, IconHistory, IconTrash, IconVolume } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AdminWord, type SaveWord } from "../api";
import { ImageCreditText } from "../components/ImageCredit";
import { Select } from "../components/AppSelect";
import { ImageField } from "../components/ImageField";
import { WordPreview } from "../components/WordPreview";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { notifyError, notifySaved, posLabel, speak } from "../lib";

const EMPTY: SaveWord = {
  deckId: "",
  word: "",
  ipa: "",
  pos: "noun",
  level: "A1",
  meaningVi: "",
  example: "",
  exampleVi: "",
  imageUrl: null,
  published: true,
};

export function WordEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const desktop = useMediaQuery("(min-width: 64em)", true);

  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: 60_000 });
  const existing = useQuery({ queryKey: ["word", id], queryFn: () => api.word(id!), enabled: !isNew });

  const initial = useMemo<SaveWord | null>(() => {
    if (isNew) return EMPTY;
    const w = existing.data;
    return w
      ? {
          deckId: w.deckId,
          word: w.word,
          ipa: w.ipa,
          pos: w.pos,
          level: w.level,
          meaningVi: w.meaningVi,
          example: w.example,
          exampleVi: w.exampleVi,
          imageUrl: w.imageUrl,
          published: w.published,
        }
      : null;
  }, [isNew, existing.data]);

  const [form, setForm] = useState<SaveWord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const dirty = form !== null && initial !== null && JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!isNew && existing.error)
    return (
      <Stack maw={600}>
        <Alert color="red">{(existing.error as Error).message}</Alert>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/words")}>
          Về danh sách từ
        </Button>
      </Stack>
    );
  if (!form) return <Loader />;

  const set = <K extends keyof SaveWord>(key: K, value: SaveWord[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const learners = existing.data?.learners ?? 0;
  const savedImage = existing.data?.imageUrl ? existing.data : null;

  function back() {
    if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang?")) return;
    navigate(-1);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const saved = isNew ? await api.createWord(form) : await api.updateWord(id!, form);
      queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.setQueryData(["word", saved.id], saved);
      notifySaved(isNew ? `Đã thêm "${saved.word}"` : "Đã lưu");
      if (isNew) navigate(`/words/${encodeURIComponent(saved.id)}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.deleteWord(id!);
      queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notifySaved("Đã xoá từ");
      navigate("/words", { replace: true });
    } catch (e) {
      notifyError(e);
    } finally {
      setConfirmDelete(false);
    }
  }

  const formPanel = (
    <Paper p={{ base: "md", sm: "lg" }} radius="lg" shadow="xs">
      <Stack>
        {error ? <Alert color="red">{error}</Alert> : null}
        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <TextInput label="Từ" required value={form.word} onChange={(e) => set("word", e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <Select
              label="Loại từ"
              required
              data={(meta.data?.partsOfSpeech ?? []).map((p) => ({ value: p, label: posLabel(p) }))}
              value={form.pos}
              onChange={(v) => v && set("pos", v)}
              allowDeselect={false}
            />
          </Grid.Col>
        </Grid>
        <TextInput
          label="Phiên âm (IPA)"
          placeholder="/ˈæpəl/"
          value={form.ipa}
          onChange={(e) => set("ipa", e.currentTarget.value)}
          rightSection={
            <ActionIcon variant="subtle" onClick={() => speak(form.word)} aria-label="Nghe từ">
              <IconVolume size={18} />
            </ActionIcon>
          }
        />
        <Input.Wrapper label="Cấp độ">
          <SegmentedControl fullWidth data={meta.data?.levels ?? ["A1"]} value={form.level} onChange={(v) => set("level", v)} />
        </Input.Wrapper>
        <Textarea
          label="Nghĩa tiếng Việt"
          required
          autosize
          minRows={1}
          description="Nhiều nghĩa cách nhau bằng dấu phẩy"
          value={form.meaningVi}
          onChange={(e) => set("meaningVi", e.currentTarget.value)}
        />
        <Textarea
          label="Câu ví dụ"
          autosize
          minRows={1}
          value={form.example}
          onChange={(e) => set("example", e.currentTarget.value)}
          rightSection={
            <ActionIcon variant="subtle" onClick={() => speak(form.example)} aria-label="Nghe câu ví dụ">
              <IconVolume size={18} />
            </ActionIcon>
          }
        />
        <Textarea
          label="Nghĩa câu ví dụ"
          autosize
          minRows={1}
          value={form.exampleVi}
          onChange={(e) => set("exampleVi", e.currentTarget.value)}
        />
        <Select
          label="Bộ từ"
          required
          searchable
          data={(meta.data?.decks ?? []).map((d) => ({ value: d.id, label: d.titleVi }))}
          value={form.deckId || null}
          onChange={(v) => v && set("deckId", v)}
          allowDeselect={false}
        />
        <ImageField
          value={form.imageUrl}
          onChange={(u) => set("imageUrl", u)}
          searchText={form.word}
          footer={
            savedImage && form.imageUrl === savedImage.imageUrl ? (
              <ImageStatus
                word={savedImage}
                onApproved={(w) => {
                  queryClient.setQueryData(["word", w.id], w);
                  queryClient.invalidateQueries({ queryKey: ["words"] });
                }}
              />
            ) : null
          }
        />
        <Switch
          size="md"
          label="Hiện trong app"
          description="Từ bị ẩn không xuất hiện trong bộ từ và tìm kiếm; người đã học vẫn được ôn."
          checked={form.published}
          onChange={(e) => set("published", e.currentTarget.checked)}
        />
      </Stack>
    </Paper>
  );

  const saveButton =
    dirty || isNew ? (
      <Button miw={140} flex={desktop ? undefined : 1} leftSection={<IconDeviceFloppy size={18} />} onClick={save} loading={saving}>
        {isNew ? "Thêm từ" : "Lưu thay đổi"}
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
        <ActionIcon variant="default" size={42} radius="md" onClick={() => setConfirmDelete(true)} aria-label="Xoá">
          <IconTrash size={20} color="var(--mantine-color-red-6)" />
        </ActionIcon>
      ) : null}
      {saveButton}
    </>
  );

  return (
    <Stack gap="md" maw={1200} pb={desktop ? 0 : 80}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon variant="subtle" size="lg" onClick={back} aria-label="Quay lại">
            <IconArrowLeft />
          </ActionIcon>
          <div style={{ minWidth: 0 }}>
            <Title order={2} lineClamp={1}>
              {isNew ? "Thêm từ" : form.word || existing.data?.word}
            </Title>
            {!isNew ? (
              <Text fz="xs" c="dimmed">
                Mã: {id} · {learners > 0 ? `${learners} người đã học` : "chưa ai học"}
              </Text>
            ) : null}
          </div>
        </Group>
        {desktop ? <Group gap="sm" wrap="nowrap">{actions}</Group> : null}
      </Group>

      {desktop ? (
        <Grid gap="lg" align="flex-start">
          <Grid.Col span={7}>{formPanel}</Grid.Col>
          <Grid.Col span={5} style={{ position: "sticky", top: 16 }}>
            <WordPreview word={form} />
          </Grid.Col>
        </Grid>
      ) : (
        <Tabs defaultValue="form" keepMounted={false}>
          <Tabs.List grow mb="sm">
            <Tabs.Tab value="form">Thông tin</Tabs.Tab>
            <Tabs.Tab value="preview">Xem trước</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="form">{formPanel}</Tabs.Panel>
          <Tabs.Panel value="preview">
            <WordPreview word={form} />
          </Tabs.Panel>
        </Tabs>
      )}

      {!desktop ? (
        <Paper
          shadow="md"
          p="sm"
          style={{ position: "fixed", left: 0, right: 0, bottom: 64, zIndex: 50, borderRadius: 0 }}
        >
          <Group gap="sm" wrap="nowrap">
            {actions}
          </Group>
        </Paper>
      ) : null}

      {!isNew ? (
        <HistoryDrawer
          opened={historyOpen}
          onClose={() => setHistoryOpen(false)}
          entityType="word"
          entityId={id!}
          title={existing.data?.word ?? id!}
          onRestored={() => setHistoryOpen(false)}
        />
      ) : null}

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Xoá từ này?">
        {learners > 0 ? (
          <Stack>
            <Text>
              Đã có <b>{learners}</b> người học từ này nên không xoá được (sẽ mất tiến độ của họ).
            </Text>
            <Text>
              Hãy tắt <b>Hiện trong app</b> rồi lưu để ẩn từ.{" "}
              <Anchor
                onClick={() => {
                  set("published", false);
                  setConfirmDelete(false);
                }}
              >
                Tắt giúp tôi
              </Anchor>
            </Text>
          </Stack>
        ) : (
          <Stack>
            <Text>Từ "{existing.data?.word}" sẽ bị xoá vĩnh viễn. Chưa ai học từ này.</Text>
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

/** Credit for stock photos, plus the approve button for auto-picked ones (the app hides those until approved). */
function ImageStatus({ word, onApproved }: { word: AdminWord; onApproved: (w: AdminWord) => void }) {
  const [approving, setApproving] = useState(false);
  if (!word.imagePending && !word.imageCredit) return null;
  return (
    <Stack gap={6} mt="xs">
      {word.imageCredit ? <ImageCreditText credit={word.imageCredit} /> : null}
      {word.imagePending ? (
        <Alert color="yellow" p="xs">
          <Group justify="space-between" gap="xs">
            <Text fz="sm">Ảnh tự gán, chưa duyệt: app chưa hiện ảnh này.</Text>
            <Button
              size="compact-sm"
              color="green"
              leftSection={<IconCheck size={14} />}
              loading={approving}
              onClick={async () => {
                setApproving(true);
                try {
                  onApproved(await api.approveWordImage(word.id));
                  notifySaved("Đã duyệt ảnh");
                } catch (e) {
                  notifyError(e);
                } finally {
                  setApproving(false);
                }
              }}
            >
              Duyệt ảnh
            </Button>
          </Group>
        </Alert>
      ) : null}
    </Stack>
  );
}
