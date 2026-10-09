import { ActionIcon, Badge, Group, Paper, Stack, Table, Text } from "@mantine/core";
import { IconCircleCheckFilled, IconCircleXFilled, IconVolume } from "@tabler/icons-react";
import type { Bilingual, GrammarLesson, GrammarSection } from "../api";
import { speak } from "../lib";
import { kindLabel, sectionLabel } from "./meta";

const ACCENT = "#0F6B5C";
const ACCENT_SOFT = "#DCEFE8";

/** Web rendering of mobile/src/components/grammar/TheoryView.tsx plus the lesson header. */
export function TheoryPreview({ lesson }: { lesson: GrammarLesson }) {
  return (
    <Stack gap="md">
      <div>
        <Group gap={8}>
          <Badge radius="sm" variant="filled">
            {lesson.level}
          </Badge>
          {lesson.titleEn ? (
            <Text c="dimmed" fw={600} fz="sm">
              {lesson.titleEn}
            </Text>
          ) : null}
        </Group>
        <Text fz={26} fw={800} c="#1A2E28" mt={4}>
          {lesson.titleVi || "Tên bài"}
        </Text>
        <Text>{lesson.summaryVi}</Text>
      </div>
      {lesson.sections.map((s, i) => (
        <Paper key={i} radius={20} p="md" shadow={s.type === "tip" ? undefined : "xs"} bg={s.type === "tip" ? ACCENT_SOFT : "white"}>
          <Text fw={800} c={s.type === "tip" ? "#1A2E28" : ACCENT} mb={8}>
            {s.type === "tip" ? "💡 " : ""}
            {s.title || sectionLabel(s.type)}
          </Text>
          <SectionBody section={s} />
        </Paper>
      ))}
    </Stack>
  );
}

function SectionBody({ section: s }: { section: GrammarSection }) {
  switch (s.type) {
    case "usage":
      return (
        <Stack gap="sm">
          {s.items?.map((it, i) => (
            <Group key={i} gap={10} align="flex-start" wrap="nowrap">
              <Badge circle size="md" variant="light">
                {i + 1}
              </Badge>
              <div style={{ flex: 1 }}>
                <Text>{it.textVi}</Text>
                <Example example={it.example} />
              </div>
            </Group>
          ))}
        </Stack>
      );
    case "formula":
      return (
        <Stack gap="sm">
          {s.rows?.map((r, i) => (
            <div key={i}>
              <Badge radius="sm" variant="light" color={r.kind === "negative" ? "red" : r.kind === "question" ? "gray" : "brand"}>
                {kindLabel(r.kind)}
              </Badge>
              <Text fw={700} mt={4}>
                {r.pattern}
              </Text>
              <Example example={r.example} />
            </div>
          ))}
        </Stack>
      );
    case "table":
      return (
        <Table withTableBorder striped fz="sm">
          <Table.Thead bg={ACCENT_SOFT}>
            <Table.Tr>
              {s.headers?.map((h, i) => (
                <Table.Th key={i} c={ACCENT}>
                  {h}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {s.cells?.map((row, r) => (
              <Table.Tr key={r}>
                {row.map((c, i) => (
                  <Table.Td key={i} fw={i === 0 ? 700 : undefined}>
                    {c}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      );
    case "examples":
      return (
        <Stack gap="xs">
          {s.items?.map((it, i) => (
            <Example key={i} example={{ en: it.en ?? "", vi: it.vi ?? "" }} large />
          ))}
        </Stack>
      );
    case "signals":
      return (
        <Group gap={8}>
          {s.words?.map((w) => (
            <Badge key={w} size="lg" variant="light" radius="xl" fw={600}>
              {w}
            </Badge>
          ))}
        </Group>
      );
    case "mistakes":
      return (
        <Stack gap="sm">
          {s.items?.map((m, i) => (
            <div key={i}>
              <Group gap={6} wrap="nowrap">
                <IconCircleXFilled size={18} color="#E03131" />
                <Text c="red.7" td="line-through">
                  {m.wrong}
                </Text>
              </Group>
              <Group gap={6} wrap="nowrap">
                <IconCircleCheckFilled size={18} color={ACCENT} />
                <Text c={ACCENT} fw={700}>
                  {m.right}
                </Text>
              </Group>
              {m.noteVi ? (
                <Text fz="sm" c="dimmed" ml={24}>
                  {m.noteVi}
                </Text>
              ) : null}
            </div>
          ))}
        </Stack>
      );
    default:
      return <Text>{s.textVi}</Text>;
  }
}

function Example({ example, large }: { example?: Bilingual | null; large?: boolean }) {
  if (!example?.en) return null;
  return (
    <Group gap={8} wrap="nowrap" mt={4}>
      <div style={{ flex: 1 }}>
        <Text fs={large ? undefined : "italic"} fw={large ? 600 : undefined}>
          {example.en}
        </Text>
        {example.vi ? (
          <Text fz="sm" c="dimmed">
            {example.vi}
          </Text>
        ) : null}
      </div>
      <ActionIcon variant="light" radius="xl" onClick={() => speak(example.en)} aria-label="Nghe">
        <IconVolume size={16} />
      </ActionIcon>
    </Group>
  );
}
