import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  FileButton,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Input,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconLink, IconPhoto, IconPhotoSearch, IconPhotoUp, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type DragEvent, type ReactNode } from "react";
import { api, mediaSrc } from "../api";
import { notifyError } from "../lib";
import { StockSearchPanel } from "./StockSearchPanel";

/**
 * Word image picker: search Pexels / Pixabay, upload (drag & drop on desktop, camera/library on phones),
 * pick from the media library, or paste a URL. Images are centre-cropped to a square by the server.
 */
export function ImageField({
  value,
  onChange,
  searchText,
  footer,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Starting query for the stock photo search (the word itself). */
  searchText: string;
  footer?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [crop, setCrop] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  async function upload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const media = await api.uploadMedia(file, crop);
      onChange(media.url);
      queryClient.invalidateQueries({ queryKey: ["media"] });
    } catch (e) {
      notifyError(e);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) upload(file);
  }

  return (
    <Stack gap="xs">
      <Input.Label>Hình ảnh</Input.Label>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "#0F6B5C" : "#C5D8CF"}`,
          borderRadius: 12,
          padding: 12,
          background: dragging ? "#E7F4F0" : "white",
        }}
      >
        <Group align="center" wrap="nowrap">
          {value ? (
            <Image src={mediaSrc(value)} w={96} h={96} radius="md" fit="cover" alt="" />
          ) : (
            <Box w={96} h={96} style={{ borderRadius: 8, background: "#F1F5F3", display: "grid", placeItems: "center" }}>
              <IconPhoto size={32} color="#9AB0A7" />
            </Box>
          )}
          <Stack gap={6} style={{ flex: 1 }}>
            <Group gap={6}>
              <Button size="sm" leftSection={<IconPhotoSearch size={16} />} onClick={() => setSearchOpen(true)}>
                Tìm ảnh
              </Button>
              <FileButton onChange={upload} accept="image/png,image/jpeg,image/webp">
                {(props) => (
                  <Button {...props} size="sm" variant="light" leftSection={<IconPhotoUp size={16} />} loading={uploading}>
                    Tải lên
                  </Button>
                )}
              </FileButton>
              <Button size="sm" variant="light" onClick={() => setLibraryOpen(true)}>
                Thư viện
              </Button>
              <ActionIcon size={36} variant="light" onClick={() => setUrlOpen(true)} aria-label="Dán URL ảnh">
                <IconLink size={18} />
              </ActionIcon>
              {value ? (
                <ActionIcon size={36} variant="light" color="red" onClick={() => onChange(null)} aria-label="Bỏ ảnh">
                  <IconTrash size={18} />
                </ActionIcon>
              ) : null}
            </Group>
            <Checkbox size="xs" checked={crop} onChange={(e) => setCrop(e.currentTarget.checked)} label="Cắt vuông khi tải lên" />
            <Text fz="xs" c="dimmed" visibleFrom="sm">
              Hoặc kéo thả ảnh vào khung này. Ảnh được thu nhỏ tối đa 800px, lưu dạng WebP.
            </Text>
          </Stack>
        </Group>
        {footer}
      </Box>

      <Modal opened={searchOpen} onClose={() => setSearchOpen(false)} title="Tìm ảnh trên Pexels / Pixabay" size="xl">
        {searchOpen ? (
          <StockSearchPanel
            initialQuery={searchText}
            onPick={async (img) => {
              try {
                const media = await api.importStock({ source: img.source, id: img.id });
                onChange(media.url);
                queryClient.invalidateQueries({ queryKey: ["media"] });
                setSearchOpen(false);
              } catch (e) {
                notifyError(e);
              }
            }}
          />
        ) : null}
      </Modal>

      <Modal opened={urlOpen} onClose={() => setUrlOpen(false)} title="Dán đường dẫn ảnh">
        <Stack>
          <TextInput placeholder="https://…" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
          <Button
            onClick={() => {
              onChange(url.trim() || null);
              setUrlOpen(false);
              setUrl("");
            }}
          >
            Dùng ảnh này
          </Button>
        </Stack>
      </Modal>

      <MediaLibraryModal
        opened={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(u) => {
          onChange(u);
          setLibraryOpen(false);
        }}
      />
    </Stack>
  );
}

function MediaLibraryModal({ opened, onClose, onPick }: { opened: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["media"], queryFn: api.media, enabled: opened });
  return (
    <Modal opened={opened} onClose={onClose} title="Chọn ảnh đã tải lên" size="lg">
      {isLoading ? <Text c="dimmed">Đang tải…</Text> : null}
      {data && data.length === 0 ? <Text c="dimmed">Chưa có ảnh nào.</Text> : null}
      <SimpleGrid cols={{ base: 3, sm: 4 }}>
        {data?.map((m) => (
          <UnstyledButton key={m.id} onClick={() => onPick(m.url)}>
            <Image src={mediaSrc(m.url)} radius="md" alt={m.originalName} style={{ aspectRatio: "1" }} fit="cover" />
            <Text fz="xs" c="dimmed" truncate mt={2}>
              {m.usedBy > 0 ? `Đang dùng: ${m.usedBy}` : "Chưa dùng"}
            </Text>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Modal>
  );
}
