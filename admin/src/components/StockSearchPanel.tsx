import { Alert, Anchor, Box, Button, Group, Image, Loader, Overlay, SimpleGrid, Skeleton, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, stockLabel, type StockImage } from "../api";

/**
 * Searches Pexels and Pixabay and lets the admin click a photo. Previews load from the providers;
 * the picked photo is downloaded by the server, so only the chosen one is stored.
 * Remount with a new `key` to start over for another word.
 */
export function StockSearchPanel({
  initialQuery,
  onPick,
  cols = { base: 2, xs: 3, md: 4 },
}: {
  initialQuery: string;
  onPick: (image: StockImage) => Promise<unknown>;
  cols?: Record<string, number>;
}) {
  const [input, setInput] = useState(initialQuery);
  const [search, setSearch] = useState({ q: initialQuery.trim(), page: 1 });
  const [picking, setPicking] = useState<string | null>(null);

  const result = useQuery({
    queryKey: ["stock", search.q.toLowerCase(), search.page],
    queryFn: () => api.searchStock(search.q, search.page),
    enabled: search.q.length > 0,
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  async function pick(image: StockImage) {
    if (picking) return;
    setPicking(`${image.source}:${image.id}`);
    try {
      await onPick(image);
    } finally {
      setPicking(null);
    }
  }

  const items = result.data?.items ?? [];

  return (
    <Stack gap="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch({ q: input.trim(), page: 1 });
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            type="search"
            autoComplete="off"
            placeholder="Từ khoá tiếng Anh, ví dụ: bank building"
            leftSection={<IconSearch size={16} />}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          <Button type="submit" variant="light" loading={result.isFetching && !picking}>
            Tìm
          </Button>
        </Group>
      </form>

      {result.error ? <Alert color="red">{(result.error as Error).message}</Alert> : null}
      {result.data?.errors.length ? (
        <Alert color="yellow" p="xs">
          {result.data.errors.join(" · ")}
        </Alert>
      ) : null}

      {result.isLoading ? (
        <SimpleGrid cols={cols} spacing="xs">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} radius="md" style={{ aspectRatio: "1" }} />
          ))}
        </SimpleGrid>
      ) : null}

      {result.data && items.length === 0 ? (
        <Text c="dimmed" ta="center" py="md" fz="sm">
          Không tìm thấy ảnh cho "{result.data.query}". Thử từ khoá khác (tiếng Anh, cụ thể hơn).
        </Text>
      ) : null}

      <SimpleGrid cols={cols} spacing="xs" style={{ opacity: result.isFetching && !result.isLoading ? 0.6 : 1 }}>
        {items.map((img) => {
          const key = `${img.source}:${img.id}`;
          return (
            <UnstyledButton
              key={key}
              onClick={() => pick(img)}
              disabled={!!picking}
              title={img.description ?? undefined}
              style={{ borderRadius: 8, overflow: "hidden" }}
            >
              <Box pos="relative">
                <Image src={img.previewUrl} alt={img.description ?? ""} radius="md" fit="cover" style={{ aspectRatio: "1" }} loading="lazy" />
                {picking === key ? (
                  <Overlay color="#fff" backgroundOpacity={0.6} radius="md" center>
                    <Loader size="sm" />
                  </Overlay>
                ) : null}
              </Box>
              <Text fz={10} c="dimmed" truncate mt={2}>
                {stockLabel(img.source)} · {img.author}
              </Text>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      {result.data && (items.length > 0 || search.page > 1) ? (
        <Group justify="space-between">
          <Text fz="xs" c="dimmed">
            Ảnh từ{" "}
            <Anchor href="https://www.pexels.com" target="_blank" fz="xs">
              Pexels
            </Anchor>{" "}
            và{" "}
            <Anchor href="https://pixabay.com" target="_blank" fz="xs">
              Pixabay
            </Anchor>
            . Bấm vào ảnh để dùng.
          </Text>
          <Group gap={4}>
            <Button
              size="compact-sm"
              variant="subtle"
              disabled={search.page <= 1}
              onClick={() => setSearch((s) => ({ ...s, page: s.page - 1 }))}
              leftSection={<IconChevronLeft size={14} />}
            >
              Trước
            </Button>
            <Button
              size="compact-sm"
              variant="subtle"
              disabled={items.length === 0}
              onClick={() => setSearch((s) => ({ ...s, page: s.page + 1 }))}
              rightSection={<IconChevronRight size={14} />}
            >
              Thêm ảnh
            </Button>
          </Group>
        </Group>
      ) : null}
    </Stack>
  );
}
