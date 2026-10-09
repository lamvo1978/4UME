import { Paper, Stack, Text, Title } from "@mantine/core";

export function ComingSoonPage({ title, phase }: { title: string; phase: string }) {
  return (
    <Stack maw={720}>
      <Title order={2}>{title}</Title>
      <Paper p="xl" radius="lg" shadow="xs">
        <Text fw={600}>Đang xây dựng</Text>
        <Text c="dimmed" mt={4}>
          Trang này sẽ có ở {phase} của kế hoạch web admin.
        </Text>
      </Paper>
    </Stack>
  );
}
