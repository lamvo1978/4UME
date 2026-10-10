import {
  Alert,
  Anchor,
  Badge,
  Button,
  CloseButton,
  FileButton,
  Group,
  Image,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowLeft, IconCheck, IconLock, IconLockOpen, IconPhoto, IconSend } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, mediaSrc, type AdminFeedbackTicket, type FeedbackMessage } from "../api";
import { Select } from "../components/AppSelect";
import { categoryMeta, CLOSED_BY, STATUSES } from "../feedback/meta";
import { fullTime, notifyError, notifySaved } from "../lib";

const MAX_BODY = 2000;
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function FeedbackTicketPage() {
  const { id = "" } = useParams();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const queryClient = useQueryClient();
  const ticket = useQuery({
    queryKey: ["feedback-ticket", id],
    queryFn: async () => {
      const t = await api.feedbackTicket(id);
      queryClient.invalidateQueries({ queryKey: ["feedback-counts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      return t;
    },
  });
  const settings = useQuery({ queryKey: ["feedback-settings"], queryFn: api.feedbackSettings });
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<"reply" | "close" | "status" | null>(null);
  const [images, setImages] = useState<File[]>([]);

  function addImages(files: File[]) {
    const tooBig = files.filter((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig.length) notifyError(new Error("Ảnh quá lớn (tối đa 15 MB)."));
    const ok = files.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (images.length + ok.length > MAX_IMAGES) notifyError(new Error(`Tối đa ${MAX_IMAGES} ảnh mỗi lần gửi.`));
    setImages((prev) => [...prev, ...ok].slice(0, MAX_IMAGES));
  }

  async function run(kind: "reply" | "close" | "status", action: () => Promise<AdminFeedbackTicket>, message: string) {
    setBusy(kind);
    try {
      queryClient.setQueryData(["feedback-ticket", id], await action());
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-counts"] });
      if (kind !== "status") {
        setBody("");
        setImages([]);
      }
      notifySaved(message);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  if (ticket.error) return <Alert color="red">{(ticket.error as Error).message}</Alert>;
  if (!ticket.data) {
    return (
      <Stack maw={900}>
        <Skeleton h={60} radius="lg" />
        <Skeleton h={300} radius="lg" />
      </Stack>
    );
  }

  const t = ticket.data;
  const cat = categoryMeta(t.category);
  const closed = t.status === "closed";
  const text = body.trim();
  const templates = settings.data?.value.replies ?? [];
  const device = [t.platform, t.device, t.appVersion ? `bản ${t.appVersion}` : null].filter(Boolean).join(" · ");

  return (
    <Stack gap="md" maw={900}>
      <Anchor component={Link} to="/feedback" fz="sm" c="dimmed">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Danh sách góp ý
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start" wrap={desktop ? "nowrap" : "wrap"}>
        <div style={{ minWidth: 0 }}>
          <Group gap={6} mb={4}>
            <Badge variant="light" color={cat.color}>
              {cat.label}
            </Badge>
            <Badge variant="light" color={STATUSES[t.status].color}>
              {STATUSES[t.status].label}
            </Badge>
          </Group>
          <Title order={3} style={{ wordBreak: "break-word" }}>
            {t.subject}
          </Title>
          {closed && t.closedBy ? (
            <Text fz="sm" c="dimmed">
              {CLOSED_BY[t.closedBy] ?? "Đã đóng"}.
            </Text>
          ) : null}
        </div>
        <Button
          variant="default"
          leftSection={closed ? <IconLockOpen size={18} /> : <IconLock size={18} />}
          loading={busy === "status"}
          onClick={() =>
            closed
              ? run("status", () => api.reopenFeedback(id), "Đã mở lại góp ý")
              : run("status", () => api.closeFeedback(id), "Đã đóng góp ý")
          }
          style={{ flexShrink: 0 }}
        >
          {closed ? "Mở lại" : "Đóng góp ý"}
        </Button>
      </Group>

      <Paper p="md" radius="lg" shadow="xs">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Info label="Người gửi">
            <Anchor component={Link} to={`/users/${t.user.id}`} fz="sm" fw={600}>
              {t.user.displayName}
            </Anchor>
            <Text fz="xs" c="dimmed">
              {t.user.email}
            </Text>
          </Info>
          <Info label="Từ được báo">
            {t.word ? (
              <>
                <Anchor component={Link} to={`/words/${encodeURIComponent(t.word.id)}`} fz="sm" fw={600}>
                  {t.word.text}
                </Anchor>
                <Text fz="xs" c="dimmed">
                  {t.word.meaningVi} · {t.word.level}
                </Text>
              </>
            ) : (
              <Text fz="sm" c="dimmed">
                —
              </Text>
            )}
          </Info>
          <Info label="Thiết bị">
            <Text fz="sm">{device || "—"}</Text>
          </Info>
        </SimpleGrid>
      </Paper>

      <Stack gap="sm">
        {t.messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
      </Stack>

      {closed ? (
        <Alert color="gray" variant="light">
          Góp ý đã đóng nên người dùng không trả lời thêm được. Bấm <b>Mở lại</b> nếu muốn trao đổi tiếp.
        </Alert>
      ) : (
        <Paper p="md" radius="lg" shadow="xs">
          <Stack gap="xs">
            {templates.length ? (
              <Select
                placeholder="Chèn câu trả lời mẫu…"
                data={templates.map((r, i) => ({ value: String(i), label: r.title }))}
                value={null}
                onChange={(v) => {
                  if (v === null) return;
                  const tpl = templates[Number(v)].body;
                  setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${tpl}` : tpl));
                }}
              />
            ) : null}
            <Textarea
              placeholder="Trả lời người dùng… (dán ảnh chụp màn hình bằng Cmd+V)"
              autosize
              minRows={4}
              maxRows={14}
              maxLength={MAX_BODY}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
                if (pasted.length) {
                  e.preventDefault();
                  addImages(pasted);
                }
              }}
            />
            {images.length ? (
              <Group gap="xs">
                {images.map((img, i) => (
                  <PendingImage key={i} file={img} onRemove={() => setImages((prev) => prev.filter((_, j) => j !== i))} />
                ))}
              </Group>
            ) : null}
            <Group justify="space-between">
              <FileButton onChange={addImages} accept="image/png,image/jpeg,image/webp,image/gif" multiple>
                {(props) => (
                  <Button {...props} variant="subtle" leftSection={<IconPhoto size={18} />} disabled={images.length >= MAX_IMAGES}>
                    Thêm ảnh ({images.length}/{MAX_IMAGES})
                  </Button>
                )}
              </FileButton>
              <Group gap="xs">
                <Button
                  variant="default"
                  leftSection={<IconCheck size={18} />}
                  disabled={!text}
                  loading={busy === "close"}
                  onClick={() => run("close", () => api.replyFeedback(id, text, true, images), "Đã trả lời và đóng góp ý")}
                >
                  Trả lời & đóng
                </Button>
                <Button
                  leftSection={<IconSend size={18} />}
                  disabled={!text}
                  loading={busy === "reply"}
                  onClick={() => run("reply", () => api.replyFeedback(id, text, false, images), "Đã gửi trả lời")}
                >
                  Gửi trả lời
                </Button>
              </Group>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function PendingImage({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div style={{ position: "relative" }}>
      {src ? <Image src={src} w={88} h={88} radius="md" fit="cover" alt={file.name} /> : null}
      <CloseButton
        size="sm"
        radius="xl"
        variant="filled"
        aria-label="Bỏ ảnh"
        onClick={onRemove}
        style={{ position: "absolute", top: -6, right: -6 }}
      />
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Text fz="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      {children}
    </div>
  );
}

function Message({ message: m }: { message: FeedbackMessage }) {
  return (
    <Paper
      p="md"
      radius="lg"
      shadow="xs"
      ml={m.fromAdmin ? "xl" : 0}
      mr={m.fromAdmin ? 0 : "xl"}
      bg={m.fromAdmin ? "var(--mantine-color-teal-light)" : undefined}
    >
      <Group justify="space-between" mb={4}>
        <Text fz="sm" fw={700}>
          {m.fromAdmin ? `${m.authorName ?? "Quản trị"} (4UME)` : "Người dùng"}
        </Text>
        <Text fz="xs" c="dimmed">
          {fullTime(m.createdAt)}
        </Text>
      </Group>
      <Text fz="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {m.body}
      </Text>
      {m.images.length ? (
        <Group gap="xs" mt="sm">
          {m.images.map((url) => (
            <a key={url} href={mediaSrc(url)} target="_blank" rel="noreferrer">
              <Image src={mediaSrc(url)} w={120} h={120} radius="md" fit="cover" alt="Ảnh đính kèm" />
            </a>
          ))}
        </Group>
      ) : null}
    </Paper>
  );
}
