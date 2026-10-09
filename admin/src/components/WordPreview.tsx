import { ActionIcon, Badge, Group, Image, List, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconVolume } from "@tabler/icons-react";
import { mediaSrc, type SaveWord } from "../api";
import { exerciseWarnings, posLabel, speak } from "../lib";

/** Front and back of the app's flashcard, plus what the app can and can't generate for this word. */
export function WordPreview({ word }: { word: SaveWord }) {
  const warnings = exerciseWarnings(word);
  return (
    <Stack gap="md">
      <Text fw={700} fz="sm" tt="uppercase" c="dimmed">
        Xem trước trên app
      </Text>
      <Paper radius={24} p="lg" shadow="sm" style={{ textAlign: "center" }}>
        {word.imageUrl ? (
          <Image src={mediaSrc(word.imageUrl)} h={160} w="100%" radius="lg" fit="cover" mb="md" alt="" />
        ) : null}
        <Text ff="heading" fz={36} fw={700} c="#1A2E28" style={{ wordBreak: "break-word" }}>
          {word.word || "…"}
        </Text>
        <Group justify="center" gap={8} mt={4}>
          <Text c="dimmed" fz="lg">
            {word.ipa}
          </Text>
          <ActionIcon variant="light" radius="xl" size="lg" onClick={() => speak(word.word)} aria-label="Nghe">
            <IconVolume size={18} />
          </ActionIcon>
        </Group>
        <Group justify="center" gap={6} mt="sm">
          <Badge variant="light" color="gray">
            {posLabel(word.pos)}
          </Badge>
          <Badge variant="light">{word.level}</Badge>
        </Group>
      </Paper>
      <Paper radius={24} p="lg" shadow="sm" bg="#F7FBF8">
        <Text fw={700} fz="xl" c="#0F6B5C">
          {word.meaningVi || "Nghĩa tiếng Việt"}
        </Text>
        {word.example ? (
          <Group gap={6} mt="md" wrap="nowrap" align="flex-start">
            <ActionIcon variant="subtle" onClick={() => speak(word.example)} aria-label="Nghe câu ví dụ">
              <IconVolume size={16} />
            </ActionIcon>
            <div>
              <Text fs="italic">{word.example}</Text>
              <Text c="dimmed" fz="sm">
                {word.exampleVi}
              </Text>
            </div>
          </Group>
        ) : null}
      </Paper>

      {warnings.length > 0 ? (
        <Paper p="md" radius="lg" bg="#FFF6EC">
          <List
            spacing={6}
            size="sm"
            icon={
              <ThemeIcon color="orange" size={20} radius="xl" variant="light">
                <IconAlertTriangle size={13} />
              </ThemeIcon>
            }
          >
            {warnings.map((w) => (
              <List.Item key={w}>{w}</List.Item>
            ))}
          </List>
        </Paper>
      ) : (
        <Paper p="md" radius="lg" bg="#E7F4F0">
          <Group gap={8}>
            <ThemeIcon size={22} radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
            <Text fz="sm">Đủ dữ liệu cho mọi dạng bài luyện tập.</Text>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
