import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  Pagination,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import {
  IconArrowRight,
  IconCheck,
  IconExternalLink,
  IconPhoto,
  IconPhotoSearch,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconVolume,
  IconWand,
} from "@tabler/icons-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, mediaSrc, type AdminWord, type AutoImageRequest, type WordFilters } from "../api";
import { Select } from "../components/AppSelect";
import { ImageCreditText } from "../components/ImageCredit";
import { StockSearchPanel } from "../components/StockSearchPanel";
import { notifyError, notifySaved, posLabel, speak } from "../lib";
import classes from "./ImageAssignPage.module.css";

const REVIEW_PAGE = 24;
const QUEUE_PAGE = 50;

/** Pick stock photos word by word, auto-assign in bulk, and review auto-picked images. */
export function ImageAssignPage() {
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const tab = params.get("tab") === "review" ? "review" : "pick";
  const filters = {
    level: params.get("level") ?? undefined,
    deckId: params.get("deck") ?? undefined,
    // Concrete nouns get the best photo matches, so they are the default.
    pos: params.has("pos") ? params.get("pos") || undefined : "noun",
  };
  const [autoOpen, setAutoOpen] = useState(false);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value !== null) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }

  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: 60_000 });
  const pendingCount = useQuery({
    queryKey: ["words", { missing: "image-review", count: true }],
    queryFn: () => api.words({ missing: "image-review", pageSize: 1 }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["words"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["media"] });
  };

  return (
    <Stack gap="md" maw={1300}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Gắn ảnh cho từ</Title>
          <Text c="dimmed" fz="sm">
            Ảnh lấy từ Pexels / Pixabay, máy chủ tải về, cắt vuông và lưu WebP.
          </Text>
        </div>
        <Button leftSection={<IconWand size={18} />} variant="light" onClick={() => setAutoOpen(true)}>
          Tự gán ảnh
        </Button>
      </Group>

      <SegmentedControl
        w={{ base: "100%", sm: 420 }}
        value={tab}
        onChange={(v) => setParam("tab", v === "review" ? "review" : null)}
        data={[
          { value: "pick", label: "Chọn ảnh từng từ" },
          {
            value: "review",
            label: `Duyệt ảnh tự gán${pendingCount.data?.total ? ` (${pendingCount.data.total.toLocaleString("vi-VN")})` : ""}`,
          },
        ]}
      />

      <Paper p="sm" radius="lg" shadow="xs">
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
          <Select
            placeholder="Mọi cấp độ"
            clearable
            data={meta.data?.levels ?? []}
            value={filters.level ?? null}
            onChange={(v) => setParam("level", v)}
          />
          <Select
            placeholder="Mọi bộ từ"
            clearable
            searchable
            data={meta.data?.decks.map((d) => ({ value: d.id, label: d.titleVi })) ?? []}
            value={filters.deckId ?? null}
            onChange={(v) => setParam("deck", v)}
          />
          <Select
            placeholder="Mọi loại từ"
            clearable
            data={meta.data?.partsOfSpeech.map((p) => ({ value: p, label: posLabel(p) })) ?? []}
            value={filters.pos ?? null}
            onChange={(v) => setParam("pos", v ?? "")}
          />
        </SimpleGrid>
      </Paper>

      {tab === "pick" ? (
        <PickQueue filters={filters} desktop={desktop} onChanged={refresh} />
      ) : (
        <ReviewGrid filters={filters} onChanged={refresh} />
      )}

      <AutoAssignModal
        key={JSON.stringify(filters)}
        opened={autoOpen}
        onClose={() => setAutoOpen(false)}
        initial={filters}
        decks={meta.data?.decks ?? []}
        levels={meta.data?.levels ?? []}
        partsOfSpeech={meta.data?.partsOfSpeech ?? []}
        onProgress={refresh}
        onReview={() => {
          setAutoOpen(false);
          setParam("tab", "review");
        }}
      />
    </Stack>
  );
}

type Filters = { level?: string; deckId?: string; pos?: string };

/** Finds any word (whatever the filters) to give it an image out of queue order. */
function WordFinder({ onSelect }: { onSelect: (word: AdminWord) => void }) {
  const [text, setText] = useState("");
  const [q] = useDebouncedValue(text.trim(), 300);
  const found = useQuery({
    queryKey: ["words", { q, finder: true }],
    queryFn: () => api.words({ q, pageSize: 8 }),
    enabled: q.length > 0,
  });

  return (
    <Stack gap={4}>
      <TextInput
        placeholder="Tìm từ vựng, ví dụ: go"
        leftSection={<IconSearch size={16} />}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      {q && found.data ? (
        found.data.items.length === 0 ? (
          <Text fz="xs" c="dimmed" px={4}>
            Không có từ nào khớp "{q}".
          </Text>
        ) : (
          <Paper withBorder radius="md">
            {found.data.items.map((w) => (
              <UnstyledButton
                key={w.id}
                w="100%"
                px="sm"
                py={6}
                className={classes.finderItem}
                onClick={() => {
                  onSelect(w);
                  setText("");
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Text fz="sm" fw={700} truncate>
                    {w.word}
                  </Text>
                  <Badge size="xs" variant="light" style={{ flexShrink: 0 }}>
                    {w.level}
                  </Badge>
                  <Text fz="xs" c="dimmed" truncate style={{ flex: 1 }}>
                    {posLabel(w.pos)} · {w.meaningVi}
                  </Text>
                  {w.imageUrl ? <IconPhoto size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} /> : null}
                </Group>
              </UnstyledButton>
            ))}
          </Paper>
        )
      ) : null}
    </Stack>
  );
}

/** Words without an image, one at a time with stock photo results for it. */
function PickQueue({ filters, desktop, onChanged }: { filters: Filters; desktop: boolean; onChanged: () => void }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<AdminWord | null>(null);
  const query: WordFilters = { ...filters, missing: "image", published: "true", page, pageSize: QUEUE_PAGE };
  const words = useQuery({ queryKey: ["words", query], queryFn: () => api.words(query), placeholderData: keepPreviousData });

  const queue = (words.data?.items ?? []).filter((w) => !skipped.includes(w.id));
  const current = chosen ?? queue[0];
  const total = words.data?.total ?? 0;
  const finder = <WordFinder onSelect={setChosen} />;

  if (words.isLoading) return <Skeleton h={320} radius="lg" />;
  if (words.error) return <Alert color="red">{(words.error as Error).message}</Alert>;
  if (!current)
    return (
      <Paper p="xl" radius="lg" shadow="xs">
        <Stack align="center" gap="xs">
          <Text fw={600}>{total === 0 ? "Mọi từ trong bộ lọc này đã có ảnh." : "Đã xem hết các từ trên trang này."}</Text>
          {total > 0 && (words.data?.items.length ?? 0) === QUEUE_PAGE ? (
            <Button variant="light" onClick={() => setPage((p) => p + 1)} rightSection={<IconArrowRight size={16} />}>
              Các từ tiếp theo
            </Button>
          ) : null}
          {skipped.length > 0 ? (
            <Button
              variant="subtle"
              onClick={() => {
                setSkipped([]);
                setPage(1);
              }}
            >
              Xem lại {skipped.length} từ đã bỏ qua
            </Button>
          ) : null}
          <div style={{ width: "100%", maxWidth: 360 }}>{finder}</div>
        </Stack>
      </Paper>
    );

  async function pick(word: AdminWord, source: string, id: string) {
    try {
      await api.setWordStockImage(word.id, { source, id });
      notifySaved(`Đã gắn ảnh cho "${word.word}"`);
      if (chosen?.id === word.id) setChosen(null);
      onChanged();
    } catch (e) {
      notifyError(e);
    }
  }

  const info = (
    <Paper p="md" radius="lg" shadow="xs">
      <Stack gap={6}>
        {finder}
        {chosen ? (
          <Alert color="blue" p="xs" mt={4}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text fz="xs">{chosen.imageUrl ? "Từ này đã có ảnh, chọn ảnh mới sẽ thay ảnh cũ." : "Từ bạn vừa tìm."}</Text>
              <Button size="compact-xs" variant="subtle" onClick={() => setChosen(null)}>
                Về hàng đợi
              </Button>
            </Group>
          </Alert>
        ) : null}
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            <Title order={3} lineClamp={1}>
              {current.word}
            </Title>
            <ActionIcon variant="subtle" onClick={() => speak(current.word)} aria-label="Nghe">
              <IconVolume size={18} />
            </ActionIcon>
          </Group>
          <Badge variant="light">{current.level}</Badge>
        </Group>
        <Text fz="sm" c="dimmed">
          {posLabel(current.pos)} · {current.ipa || "—"} · {current.deckTitleVi}
        </Text>
        <Text>{current.meaningVi}</Text>
        {current.example ? (
          <Text fz="sm" fs="italic" c="dimmed">
            {current.example}
          </Text>
        ) : null}
        <Group gap="xs" mt="xs">
          <Button
            variant="default"
            onClick={() => (chosen ? setChosen(null) : setSkipped((s) => [...s, current.id]))}
            rightSection={<IconArrowRight size={16} />}
          >
            Bỏ qua
          </Button>
          <Button
            variant="subtle"
            component={Link}
            to={`/words/${encodeURIComponent(current.id)}`}
            target="_blank"
            leftSection={<IconExternalLink size={16} />}
          >
            Mở trang sửa
          </Button>
        </Group>
        <Text fz="xs" c="dimmed" mt="xs">
          Còn {(total - skipped.length).toLocaleString("vi-VN")} từ chưa có ảnh trong bộ lọc này. Từ khó tả bằng ảnh thì bấm Bỏ qua.
        </Text>
      </Stack>
    </Paper>
  );

  const search = (
    <Paper p="md" radius="lg" shadow="xs">
      <Text fz="sm" c="dimmed" mb="xs">
        Tìm ảnh cho <b>{current.word}</b> — đổi từ khoá bên dưới nếu ảnh chưa hợp.
      </Text>
      <StockSearchPanel key={current.id} initialQuery={current.word} onPick={(img) => pick(current, img.source, img.id)} />
    </Paper>
  );

  return desktop ? (
    <Group align="flex-start" gap="md" wrap="nowrap">
      <div style={{ width: 340, flexShrink: 0, position: "sticky", top: 16 }}>{info}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{search}</div>
    </Group>
  ) : (
    <Stack gap="md">
      {info}
      {search}
    </Stack>
  );
}

/** Auto-picked images waiting for approval; the app doesn't show them yet. */
function ReviewGrid({ filters, onChanged }: { filters: Filters; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [changing, setChanging] = useState<AdminWord | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const query: WordFilters = { ...filters, missing: "image-review", page, pageSize: REVIEW_PAGE };

  function scrollToTop() {
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToPage(next: number) {
    setPage(next);
    scrollToTop();
  }
  const words = useQuery({ queryKey: ["words", query], queryFn: () => api.words(query), placeholderData: keepPreviousData });
  const items = words.data?.items ?? [];
  const pages = words.data ? Math.max(1, Math.ceil(words.data.total / REVIEW_PAGE)) : 1;

  async function run(key: string, action: () => Promise<unknown>, message?: string) {
    setBusy(key);
    try {
      await action();
      if (message) notifySaved(message);
      onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  if (words.isLoading) return <Skeleton h={320} radius="lg" />;
  if (words.error) return <Alert color="red">{(words.error as Error).message}</Alert>;

  return (
    <Stack gap="md" ref={top} style={{ scrollMarginTop: 80 }}>
      {items.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Không có ảnh nào chờ duyệt trong bộ lọc này.
        </Text>
      ) : (
        <Group justify="space-between">
          <Text fz="sm" c="dimmed">
            {words.data!.total.toLocaleString("vi-VN")} ảnh chờ duyệt. Ảnh sai thì bấm đổi ảnh hoặc bỏ ảnh.
          </Text>
          <Button
            color="green"
            variant="light"
            leftSection={<IconCheck size={16} />}
            loading={busy === "all"}
            onClick={() =>
              run(
                "all",
                async () => {
                  for (const w of items) await api.approveWordImage(w.id);
                  scrollToTop();
                },
                `Đã duyệt ${items.length} ảnh`,
              )
            }
          >
            Duyệt cả trang ({items.length})
          </Button>
        </Group>
      )}

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm" style={{ opacity: words.isFetching ? 0.6 : 1 }}>
        {items.map((w) => (
          <Card key={w.id} radius="lg" shadow="xs" p={6}>
            <Image src={mediaSrc(w.imageUrl!)} radius="md" fit="cover" style={{ aspectRatio: "1" }} alt={w.word} />
            <Stack gap={2} p={4}>
              <Text fw={700} truncate>
                {w.word}
              </Text>
              <Text fz="xs" c="dimmed" lineClamp={2} h={32}>
                {w.meaningVi}
              </Text>
              {w.imageCredit ? <ImageCreditText credit={w.imageCredit} /> : null}
              <Group gap={4} justify="space-between" mt={4} wrap="nowrap">
                <Button
                  size="compact-sm"
                  color="green"
                  leftSection={<IconCheck size={14} />}
                  loading={busy === w.id}
                  onClick={() => run(w.id, () => api.approveWordImage(w.id))}
                >
                  Duyệt
                </Button>
                <Group gap={2} wrap="nowrap">
                  <Tooltip label="Đổi ảnh">
                    <ActionIcon variant="subtle" onClick={() => setChanging(w)} aria-label="Đổi ảnh">
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Bỏ ảnh">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => run(`rm:${w.id}`, () => api.removeWordImage(w.id))}
                      loading={busy === `rm:${w.id}`}
                      aria-label="Bỏ ảnh"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {pages > 1 ? (
        <Group justify="center">
          <Pagination total={pages} value={page} onChange={goToPage} siblings={0} />
        </Group>
      ) : null}

      <Modal opened={!!changing} onClose={() => setChanging(null)} title={changing ? `Đổi ảnh cho "${changing.word}"` : ""} size="xl">
        {changing ? (
          <Stack gap="xs">
            <Text fz="sm" c="dimmed">
              {changing.meaningVi}
            </Text>
            <StockSearchPanel
              key={changing.id}
              initialQuery={changing.word}
              onPick={async (img) => {
                try {
                  await api.setWordStockImage(changing.id, { source: img.source, id: img.id });
                  notifySaved(`Đã đổi ảnh cho "${changing.word}"`);
                  setChanging(null);
                  onChanged();
                } catch (e) {
                  notifyError(e);
                }
              }}
            />
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}

type AutoStats = { processed: number; assigned: number; notFound: number; remaining: number | null };

/** Runs auto-assign in small batches so it can show progress and be paused. */
function AutoAssignModal({
  opened,
  onClose,
  initial,
  decks,
  levels,
  partsOfSpeech,
  onProgress,
  onReview,
}: {
  opened: boolean;
  onClose: () => void;
  initial: Filters;
  decks: { id: string; titleVi: string }[];
  levels: string[];
  partsOfSpeech: string[];
  onProgress: () => void;
  onReview: () => void;
}) {
  const [filters, setFilters] = useState<Filters>(initial);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<AutoStats | null>(null);
  const [message, setMessage] = useState<{ color: string; text: string } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const stop = useRef(false);

  function reset(next: Filters) {
    setFilters(next);
    setStats(null);
    setCursor(null);
    setMessage(null);
  }

  async function start() {
    stop.current = false;
    setRunning(true);
    setMessage(null);
    let after = cursor ?? undefined;
    let current = stats ?? { processed: 0, assigned: 0, notFound: 0, remaining: null };
    try {
      for (;;) {
        const request: AutoImageRequest = { ...filters, after, batch: 8 };
        const r = await api.autoImages(request);
        current = {
          processed: current.processed + r.items.length,
          assigned: current.assigned + r.assigned,
          notFound: current.notFound + r.items.filter((i) => !i.imageUrl).length,
          remaining: r.remaining,
        };
        setStats(current);
        if (r.assigned > 0) onProgress();
        after = r.next ?? undefined;
        setCursor(r.next);
        if (r.stopped) {
          setMessage({ color: "yellow", text: `${r.warning ?? "Nguồn ảnh tạm ngừng."} Bấm "Tiếp tục" sau ít phút để làm tiếp.` });
          break;
        }
        if (!r.next) {
          setMessage({ color: "green", text: "Đã xử lý hết các từ trong bộ lọc." });
          setCursor(null);
          break;
        }
        if (stop.current) break;
      }
    } catch (e) {
      setMessage({ color: "red", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  }

  const done = stats ? stats.processed : 0;
  const totalKnown = stats?.remaining != null ? done + stats.remaining : null;

  return (
    <Modal opened={opened} onClose={() => !running && onClose()} title="Tự gán ảnh" size="lg" closeOnClickOutside={!running}>
      <Stack>
        <Text fz="sm">
          Với mỗi từ chưa có ảnh, máy chủ tìm theo chính từ đó và lấy <b>ảnh đầu tiên</b> (Pexels trước, không có thì Pixabay). Ảnh được
          đánh dấu <b>chưa duyệt</b>: app chưa hiện cho tới khi bạn duyệt ở tab "Duyệt ảnh tự gán".
        </Text>
        <Alert color="blue" p="xs" fz="sm">
          Nên chạy cho <b>danh từ</b> (đồ vật, con vật, nơi chốn…). Từ trừu tượng, động từ, tính từ thường ra ảnh không khớp. Pexels cho
          200 lượt tìm / giờ; hết lượt thì tự chuyển sang Pixabay.
        </Alert>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
          <Select
            label="Cấp độ"
            placeholder="Tất cả"
            clearable
            disabled={running}
            data={levels}
            value={filters.level ?? null}
            onChange={(v) => reset({ ...filters, level: v ?? undefined })}
          />
          <Select
            label="Bộ từ"
            placeholder="Tất cả"
            clearable
            searchable
            disabled={running}
            data={decks.map((d) => ({ value: d.id, label: d.titleVi }))}
            value={filters.deckId ?? null}
            onChange={(v) => reset({ ...filters, deckId: v ?? undefined })}
          />
          <Select
            label="Loại từ"
            placeholder="Tất cả"
            clearable
            disabled={running}
            data={partsOfSpeech.map((p) => ({ value: p, label: posLabel(p) }))}
            value={filters.pos ?? null}
            onChange={(v) => reset({ ...filters, pos: v ?? undefined })}
          />
        </SimpleGrid>

        {stats ? (
          <Stack gap={6}>
            <Progress value={totalKnown ? (done / totalKnown) * 100 : 0} animated={running} />
            <Text fz="sm">
              Đã xử lý <b>{done.toLocaleString("vi-VN")}</b>
              {totalKnown != null ? ` / ${totalKnown.toLocaleString("vi-VN")}` : ""} từ · gán được <b>{stats.assigned}</b> · không tìm thấy{" "}
              {stats.notFound}
            </Text>
          </Stack>
        ) : null}
        {message ? (
          <Alert color={message.color} p="xs">
            {message.text}
          </Alert>
        ) : null}

        <Group justify="space-between">
          <Button variant="subtle" disabled={running || !stats?.assigned} leftSection={<IconPhotoSearch size={16} />} onClick={onReview}>
            Duyệt ảnh vừa gán
          </Button>
          {running ? (
            <Button
              color="orange"
              leftSection={<IconPlayerPause size={16} />}
              onClick={() => {
                stop.current = true;
              }}
            >
              Dừng sau lượt này
            </Button>
          ) : (
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={start}>
              {cursor ? "Tiếp tục" : "Bắt đầu"}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
