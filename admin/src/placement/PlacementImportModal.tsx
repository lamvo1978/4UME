import { Alert, Badge, Button, FileButton, Group, List, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconCheck, IconFileUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ImportPlacementGrammarResult } from "../api";
import { IMPORT_STATUS, notifyError, notifySaved } from "../lib";

/** Picks a .json file of placement questions (the export file, edited), previews, then saves. */
export function PlacementImportModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<unknown[]>([]);
  const [fileError, setFileError] = useState("");
  const [preview, setPreview] = useState<ImportPlacementGrammarResult | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setQuestions([]);
    setFileError("");
    setPreview(null);
    onClose();
  }

  async function pick(file: File | null) {
    if (!file) return;
    setPreview(null);
    setQuestions([]);
    let found: unknown[];
    try {
      const data = JSON.parse(await file.text());
      found = Array.isArray(data) ? data : [data];
      if (found.some((x) => typeof x !== "object" || x === null || !("prompt" in x))) throw new Error("không đúng khung câu hỏi (thiếu prompt)");
    } catch (e) {
      setFileError(`${file.name}: ${e instanceof SyntaxError ? "không đọc được nội dung JSON" : e instanceof Error ? e.message : String(e)}`);
      return;
    }
    setFileError("");
    setQuestions(found);
    setBusy(true);
    try {
      setPreview(await api.importPlacementGrammar(found, false));
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const result = await api.importPlacementGrammar(questions, true);
      notifySaved(`Đã nhập: thêm ${result.created}, cập nhật ${result.updated} câu`);
      queryClient.invalidateQueries({ queryKey: ["placement-grammar"] });
      close();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  const toSave = preview ? preview.created + preview.updated : 0;
  const shown = preview?.rows.filter((r) => r.status !== "unchanged") ?? [];

  return (
    <Modal opened={opened} onClose={close} title="Nhập câu hỏi đầu vào từ JSON" size="lg">
      <Stack>
        <Text fz="sm" c="dimmed">
          Dùng file từ <b>Xuất tất cả câu</b>, sửa rồi nhập lại. Câu có <b>id</b> sẽ được cập nhật, câu không có id được thêm mới. Câu không có
          trong file vẫn giữ nguyên (muốn xoá thì xoá trong trang này); câu có lỗi bị bỏ qua.
        </Text>
        <FileButton onChange={pick} accept="application/json,.json">
          {(props) => (
            <Button {...props} variant="default" leftSection={<IconFileUpload size={18} />} loading={busy && !preview}>
              {questions.length ? "Chọn file khác" : "Chọn file JSON"}
            </Button>
          )}
        </FileButton>

        {fileError ? <Alert color="red">{fileError}</Alert> : null}

        {preview ? (
          <>
            <Group gap="xs">
              {(["create", "update", "unchanged", "error"] as const).map((s) => {
                const n = preview.rows.filter((r) => r.status === s).length;
                return n ? (
                  <Badge key={s} color={IMPORT_STATUS[s].color} variant="light" size="lg">
                    {IMPORT_STATUS[s].label}: {n}
                  </Badge>
                ) : null;
              })}
            </Group>
            {shown.length ? (
              <ScrollArea.Autosize mah={360}>
                <Stack gap={6}>
                  {shown.map((r) => (
                    <Paper key={r.line} p="xs" radius="md" withBorder>
                      <Group justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Text fw={600} fz="sm" truncate>
                            {r.prompt || "(chưa có câu hỏi)"}
                          </Text>
                          <Text fz="xs" c="dimmed">
                            Dòng {r.line} · {r.level || "?"}
                          </Text>
                        </div>
                        <Badge color={IMPORT_STATUS[r.status].color} variant="light" style={{ flexShrink: 0 }}>
                          {IMPORT_STATUS[r.status].label}
                        </Badge>
                      </Group>
                      {r.problems.length ? (
                        <List size="xs" c="red.8" mt={4}>
                          {r.problems.map((p) => (
                            <List.Item key={p}>{p}</List.Item>
                          ))}
                        </List>
                      ) : null}
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            ) : (
              <Text fz="sm" c="dimmed">
                File giống hệt dữ liệu hiện có, không có gì để nhập.
              </Text>
            )}
          </>
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Huỷ
          </Button>
          <Button disabled={toSave === 0} loading={busy && !!preview} leftSection={<IconCheck size={18} />} onClick={commit}>
            {toSave ? `Nhập ${toSave} câu` : "Nhập"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
