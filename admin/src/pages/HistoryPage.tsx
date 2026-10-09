import { Select } from "../components/AppSelect";
import { Paper, SegmentedControl, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { HistoryList } from "../history/HistoryList";
import { ENTITY_TYPES } from "../history/meta";

const TYPES = [{ value: "", label: "Tất cả" }, ...ENTITY_TYPES];

export function HistoryPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q.trim(), 300);

  return (
    <Stack gap="md" maw={900}>
      <div>
        <Title order={2}>Lịch sử thay đổi</Title>
        <Text c="dimmed" fz="sm">
          Ai sửa gì, lúc nào. Mở một dòng để xem nội dung trước / sau và khôi phục bản cũ hoặc mục đã xoá.
        </Text>
      </div>

      <Paper p="sm" radius="lg" shadow="xs">
        <Stack gap="xs">
          <TextInput
            type="search" autoComplete="off" placeholder="Tìm theo từ, tên bài, mã hoặc người sửa…"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
          {desktop ? (
            <SegmentedControl data={TYPES} value={type} onChange={setType} />
          ) : (
            <Select data={TYPES} value={type} onChange={(v) => setType(v ?? "")} allowDeselect={false} />
          )}
        </Stack>
      </Paper>

      <HistoryList key={`${type}|${debouncedQ}`} entityType={type || undefined} q={debouncedQ || undefined} />
    </Stack>
  );
}
