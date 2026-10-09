import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  CopyButton,
  FileButton,
  Group,
  Image,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy, IconPhotoUp, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, mediaSrc, type MediaItem } from "../api";
import { ImageCreditText } from "../components/ImageCredit";
import { notifyError, notifySaved } from "../lib";

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export function MediaPage() {
  const queryClient = useQueryClient();
  const media = useQuery({ queryKey: ["media"], queryFn: api.media });
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const f of files) await api.uploadMedia(f);
      notifySaved(`Đã tải lên ${files.length} ảnh`);
    } catch (e) {
      notifyError(e);
    } finally {
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["media"] });
    }
  }

  async function remove(m: MediaItem) {
    if (!window.confirm(`Xoá ảnh "${m.originalName}"?`)) return;
    try {
      await api.deleteMedia(m.id);
      queryClient.invalidateQueries({ queryKey: ["media"] });
    } catch (e) {
      notifyError(e);
    }
  }

  const list = (media.data ?? []).filter((m) => filter === "all" || (filter === "unused" ? m.usedBy === 0 : m.usedBy > 0));

  return (
    <Stack gap="md" maw={1200}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Hình ảnh</Title>
          <Text c="dimmed" fz="sm">
            Ảnh tải lên được cắt vuông, thu nhỏ tối đa 800px và lưu dạng WebP.
          </Text>
        </div>
        <FileButton onChange={upload} accept="image/png,image/jpeg,image/webp" multiple>
          {(props) => (
            <Button {...props} leftSection={<IconPhotoUp size={18} />} loading={uploading}>
              Tải ảnh lên
            </Button>
          )}
        </FileButton>
      </Group>

      <SegmentedControl
        w={{ base: "100%", sm: 360 }}
        value={filter}
        onChange={setFilter}
        data={[
          { value: "all", label: "Tất cả" },
          { value: "used", label: "Đang dùng" },
          { value: "unused", label: "Chưa dùng" },
        ]}
      />

      {media.error ? <Alert color="red">{(media.error as Error).message}</Alert> : null}
      {media.isLoading ? <Skeleton h={200} radius="lg" /> : null}
      {media.data && list.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Chưa có ảnh nào. Ảnh cũng có thể tải lên ngay trong trang sửa từ.
        </Text>
      ) : null}

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
        {list.map((m) => (
          <Paper key={m.id} radius="lg" shadow="xs" p={6}>
            <Image src={mediaSrc(m.url)} radius="md" style={{ aspectRatio: "1" }} fit="cover" alt={m.originalName} />
            <Stack gap={2} p={6}>
              {m.credit ? (
                <ImageCreditText credit={m.credit} />
              ) : (
                <Text fz="xs" truncate title={m.originalName}>
                  {m.originalName}
                </Text>
              )}
              {m.usedBy > 0 ? (
                <Stack gap={2}>
                  {m.words.map((w) => (
                    <Group key={w.id} gap={4} wrap="nowrap">
                      <Anchor component={Link} to={`/words/${encodeURIComponent(w.id)}`} fz="xs" fw={700} truncate>
                        {w.word}
                      </Anchor>
                      <Badge size="xs" variant="light" style={{ flexShrink: 0 }}>
                        {w.level}
                      </Badge>
                      <Text fz="xs" c="dimmed" truncate title={w.deckTitle}>
                        {w.deckTitle}
                      </Text>
                    </Group>
                  ))}
                  {m.usedBy > m.words.length ? (
                    <Text fz="xs" c="dimmed">
                      +{m.usedBy - m.words.length} từ khác
                    </Text>
                  ) : null}
                </Stack>
              ) : (
                <Badge size="xs" color="gray" variant="light">
                  Chưa dùng
                </Badge>
              )}
              <Group gap={4} justify="space-between" wrap="nowrap">
                <Text fz={10} c="dimmed">
                  {m.width}×{m.height} · {kb(m.bytes)}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <CopyButton value={m.url}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Đã chép" : "Chép đường dẫn"}>
                        <ActionIcon variant="subtle" onClick={copy}>
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  <ActionIcon variant="subtle" color="red" disabled={m.usedBy > 0} onClick={() => remove(m)} aria-label="Xoá">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
