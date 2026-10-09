import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowLeft, IconCheck, IconDownload, IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ImportStatus, type ImportWordsResult } from "../api";
import { IMPORT_STATUS, notifyError, posLabel } from "../lib";
import { downloadTemplate, parseWordFile, type ParsedSheet } from "../sheets";

const FIELD_LABELS: Record<string, string> = {
  word: "từ",
  pos: "loại từ",
  level: "cấp độ",
  deck: "bộ",
  meaningVi: "nghĩa",
  ipa: "phiên âm",
  example: "câu ví dụ",
  exampleVi: "nghĩa câu ví dụ",
  imageUrl: "hình",
  published: "hiện / ẩn",
};

const PAGE = 100;

export function WordImportPage() {
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: 60_000 });

  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState<ImportWordsResult | null>(null);
  const [done, setDone] = useState<ImportWordsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ImportStatus | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const [dragging, setDragging] = useState(false);

  async function load(file: File) {
    setError("");
    setDone(null);
    setPreview(null);
    setBusy(true);
    try {
      const parsed = await parseWordFile(file);
      setFileName(file.name);
      setSheet(parsed);
      await check(parsed, updateExisting);
    } catch (e) {
      setSheet(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function check(parsed: ParsedSheet, update: boolean) {
    const result = await api.importWords(parsed.rows, update, false);
    setPreview(result);
    setFilter(result.errors > 0 ? "error" : "all");
    setShown(PAGE);
  }

  async function toggleUpdate(value: boolean) {
    setUpdateExisting(value);
    if (!sheet) return;
    setBusy(true);
    try {
      await check(sheet, value);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!sheet) return;
    setBusy(true);
    try {
      const result = await api.importWords(sheet.rows, updateExisting, true);
      setDone(result);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["decks"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSheet(null);
    setPreview(null);
    setDone(null);
    setFileName("");
    setError("");
  }

  const toSave = preview ? preview.created + preview.updated : 0;
  const rows = preview?.rows.filter((r) => filter === "all" || r.status === filter) ?? [];

  return (
    <Stack gap="md" maw={1100} pb={desktop ? 0 : 80}>
      <Group gap="xs" wrap="nowrap">
        <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/words")} aria-label="Quay lại">
          <IconArrowLeft />
        </ActionIcon>
        <div>
          <Title order={2}>Nhập từ vựng từ file</Title>
          <Text fz="sm" c="dimmed">
            Excel (.xlsx) hoặc CSV. Xem trước và kiểm tra từng dòng rồi mới lưu.
          </Text>
        </div>
      </Group>

      {done ? (
        <Alert color="green" radius="lg" icon={<IconCheck />} title="Đã nhập xong">
          <Text fz="sm">
            Thêm mới {done.created} từ, cập nhật {done.updated} từ
            {done.errors + done.duplicates > 0 ? `, bỏ qua ${done.errors + done.duplicates} dòng` : ""}.
          </Text>
          <Group mt="sm" gap="sm">
            <Button component={Link} to="/words" size="sm">
              Xem danh sách từ
            </Button>
            <Button variant="default" size="sm" onClick={reset}>
              Nhập file khác
            </Button>
          </Group>
        </Alert>
      ) : null}

      {!done ? (
        <Paper p="md" radius="lg" shadow="xs">
          <Stack gap="md">
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv"
              hidden
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (f) load(f);
              }}
            />
            <UnstyledButton
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) load(f);
              }}
              style={{
                border: `2px dashed ${dragging ? "#0F6B5C" : "#C8DDD5"}`,
                background: dragging ? "#E7F4F0" : "#F7FBF9",
                borderRadius: 16,
                padding: 24,
                textAlign: "center",
              }}
            >
              {busy && !preview ? (
                <Loader size="sm" />
              ) : (
                <Stack gap={6} align="center">
                  {fileName ? <IconFileSpreadsheet size={32} color="#0F6B5C" /> : <IconUpload size={32} color="#0F6B5C" />}
                  <Text fw={600}>{fileName || (desktop ? "Kéo file vào đây hoặc bấm để chọn" : "Chạm để chọn file")}</Text>
                  <Text fz="sm" c="dimmed">
                    {sheet ? `${sheet.rows.length} dòng dữ liệu · bấm để chọn file khác` : "Dòng đầu là tên cột: word, pos, level, deck, meaning_vi…"}
                  </Text>
                </Stack>
              )}
            </UnstyledButton>

            <Group justify="space-between" align="flex-start" gap="sm">
              <Switch
                checked={updateExisting}
                onChange={(e) => toggleUpdate(e.currentTarget.checked)}
                label="Cập nhật từ đã có"
                description="Dòng có cột id, hoặc trùng từ + loại từ với từ đang có, sẽ ghi đè từ đó."
                style={{ flex: 1, minWidth: 240 }}
              />
              <Button
                variant="default"
                leftSection={<IconDownload size={18} />}
                onClick={() => downloadTemplate(meta.data?.decks[0]?.id ?? "")}
              >
                Tải file mẫu
              </Button>
            </Group>

            <Text fz="xs" c="dimmed">
              Cột bắt buộc khi thêm mới: word, pos, level, deck (mã hoặc tên bộ), meaning_vi. Cột không có trong file thì giữ nguyên giá trị cũ;
              ô để trống thì xoá giá trị đó. Loại từ nhận cả "n", "adj", "danh từ"… Cột published: 1/0 hoặc có/không.
            </Text>
            {sheet?.ignored.length ? (
              <Text fz="xs" c="orange.8">
                Bỏ qua cột không nhận ra: {sheet.ignored.join(", ")}.
              </Text>
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      {error ? (
        <Alert color="red" radius="lg">
          {error}
        </Alert>
      ) : null}

      {preview ? (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
            <StatCard label="Tất cả" value={preview.rows.length} color="dark" active={filter === "all"} onClick={() => setFilter("all")} />
            {(["create", "update", "unchanged", "duplicate", "error"] as ImportStatus[]).map((s) => (
              <StatCard
                key={s}
                label={IMPORT_STATUS[s].label}
                color={IMPORT_STATUS[s].color}
                value={preview.rows.filter((r) => r.status === s).length}
                active={filter === s}
                onClick={() => {
                  setFilter(s);
                  setShown(PAGE);
                }}
              />
            ))}
          </SimpleGrid>

          <Paper radius="lg" shadow="xs" style={{ overflow: "hidden", opacity: busy ? 0.6 : 1 }}>
            {rows.length === 0 ? (
              <Text c="dimmed" ta="center" py="lg">
                Không có dòng nào.
              </Text>
            ) : desktop ? (
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={70}>Dòng</Table.Th>
                    <Table.Th w={220}>Từ</Table.Th>
                    <Table.Th w={110}>Kết quả</Table.Th>
                    <Table.Th>Ghi chú</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.slice(0, shown).map((r) => (
                    <Table.Tr key={r.line}>
                      <Table.Td c="dimmed">{r.line}</Table.Td>
                      <Table.Td>
                        <Text fw={600}>{r.word || "—"}</Text>
                        <Text fz="xs" c="dimmed">
                          {r.pos ? posLabel(r.pos) : ""}
                          {r.id ? ` · ${r.id}` : ""}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={IMPORT_STATUS[r.status].color} variant="light">
                          {IMPORT_STATUS[r.status].label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <RowNotes messages={r.messages} changes={r.changes} status={r.status} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Stack gap={0}>
                {rows.slice(0, shown).map((r) => (
                  <Card key={r.line} p="sm" radius={0} withBorder style={{ borderInline: 0, borderTop: 0 }}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {r.word || "—"}
                        </Text>
                        <Text fz="xs" c="dimmed">
                          Dòng {r.line}
                          {r.pos ? ` · ${posLabel(r.pos)}` : ""}
                        </Text>
                      </div>
                      <Badge color={IMPORT_STATUS[r.status].color} variant="light" style={{ flexShrink: 0 }}>
                        {IMPORT_STATUS[r.status].label}
                      </Badge>
                    </Group>
                    <RowNotes messages={r.messages} changes={r.changes} status={r.status} />
                  </Card>
                ))}
              </Stack>
            )}
            {rows.length > shown ? (
              <Group justify="center" p="sm">
                <Button variant="subtle" onClick={() => setShown((n) => n + PAGE)}>
                  Hiện thêm ({rows.length - shown} dòng)
                </Button>
              </Group>
            ) : null}
          </Paper>

          <Paper
            p="sm"
            radius={desktop ? "lg" : 0}
            shadow="md"
            style={desktop ? { position: "sticky", bottom: 16 } : { position: "fixed", left: 0, right: 0, bottom: 64, zIndex: 50 }}
          >
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text fz="sm" c="dimmed" visibleFrom="sm">
                {preview.errors + preview.duplicates > 0
                  ? `${preview.errors + preview.duplicates} dòng lỗi hoặc đã có sẽ được bỏ qua.`
                  : "Mọi dòng đều hợp lệ."}
              </Text>
              <Button flex={desktop ? undefined : 1} disabled={toSave === 0} loading={busy} onClick={commit} leftSection={<IconCheck size={18} />}>
                {toSave === 0 ? "Không có gì để lưu" : `Lưu ${toSave} từ`}
              </Button>
            </Group>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}

function StatCard({ label, value, color, active, onClick }: { label: string; value: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick}>
      <Paper p="sm" radius="lg" shadow="xs" withBorder={active} style={{ borderColor: active ? "#0F6B5C" : undefined, borderWidth: 2 }}>
        <Text fz="xs" c="dimmed">
          {label}
        </Text>
        <Text fz={22} fw={800} c={value > 0 ? color : "dimmed"}>
          {value.toLocaleString("vi-VN")}
        </Text>
      </Paper>
    </UnstyledButton>
  );
}

function RowNotes({ messages, changes, status }: { messages: string[]; changes: string[]; status: ImportStatus }) {
  if (messages.length === 0 && changes.length === 0) return null;
  return (
    <Stack gap={2}>
      {messages.length > 0 ? (
        <List size="sm" spacing={0} c={status === "error" ? "red.8" : "orange.8"}>
          {messages.map((m) => (
            <List.Item key={m}>{m}</List.Item>
          ))}
        </List>
      ) : null}
      {changes.length > 0 ? (
        <Text fz="sm" c="dimmed">
          Đổi: {changes.map((c) => FIELD_LABELS[c] ?? c).join(", ")}
        </Text>
      ) : null}
    </Stack>
  );
}
