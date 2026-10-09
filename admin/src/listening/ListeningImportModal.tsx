import { Alert, Badge, Button, FileButton, Group, List, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconCheck, IconFileUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ImportListeningResult } from "../api";
import { IMPORT_STATUS, notifyError, notifySaved } from "../lib";

/** Picks one or more .json files (a lesson object or an array of lessons each), previews, then saves. */
export function ListeningImportModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lessons, setLessons] = useState<unknown[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportListeningResult | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setLessons([]);
    setFileErrors([]);
    setPreview(null);
    onClose();
  }

  async function pick(files: File[]) {
    if (files.length === 0) return;
    const found: unknown[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try {
        const data = JSON.parse(await f.text());
        const items = Array.isArray(data) ? data : [data];
        if (items.some((x) => typeof x !== "object" || x === null || !("slug" in x))) throw new Error("không đúng khung bài (thiếu slug)");
        found.push(...items);
      } catch (e) {
        const reason = e instanceof SyntaxError ? "không đọc được nội dung JSON" : e instanceof Error ? e.message : String(e);
        errors.push(`${f.name}: ${reason}`);
      }
    }
    setFileErrors(errors);
    setLessons(found);
    setPreview(null);
    if (found.length === 0) return;
    setBusy(true);
    try {
      setPreview(await api.importListening(found, false));
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const result = await api.importListening(lessons, true);
      notifySaved(`Đã nhập: thêm ${result.created}, cập nhật ${result.updated} bài`);
      queryClient.invalidateQueries({ queryKey: ["listening"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      close();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  const toSave = preview ? preview.created + preview.updated : 0;

  return (
    <Modal opened={opened} onClose={close} title="Nhập bài nghe từ JSON" size="lg">
      <Stack>
        <Text fz="sm" c="dimmed">
          Mỗi file là một bài (cùng khung với nút JSON trong trang sửa bài) hoặc một danh sách bài (file "Xuất tất cả"). Bài trùng mã sẽ được
          cập nhật và tăng phiên bản (âm thanh cần tạo lại nếu script đổi); bài có lỗi bị bỏ qua.
        </Text>
        <FileButton onChange={pick} accept="application/json,.json" multiple>
          {(props) => (
            <Button {...props} variant="default" leftSection={<IconFileUpload size={18} />} loading={busy && !preview}>
              {lessons.length ? "Chọn file khác" : "Chọn file JSON"}
            </Button>
          )}
        </FileButton>

        {fileErrors.length ? (
          <Alert color="red">
            {fileErrors.map((e) => (
              <Text key={e} fz="sm">
                {e}
              </Text>
            ))}
          </Alert>
        ) : null}

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
            <ScrollArea.Autosize mah={360}>
              <Stack gap={6}>
                {preview.rows.map((r, i) => (
                  <Paper key={`${r.slug}-${i}`} p="xs" radius="md" withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} fz="sm" truncate>
                          {r.titleEn || "(chưa có tên)"}
                        </Text>
                        <Text fz="xs" c="dimmed">
                          {r.slug || "(thiếu mã)"}
                          {r.currentVersion ? ` · đang ở phiên bản ${r.currentVersion}` : ""}
                        </Text>
                      </div>
                      <Badge color={IMPORT_STATUS[r.status].color} variant="light" style={{ flexShrink: 0 }}>
                        {IMPORT_STATUS[r.status].label}
                      </Badge>
                    </Group>
                    {r.problems.length ? (
                      <List size="xs" c="red.8" mt={4}>
                        {r.problems.slice(0, 4).map((p) => (
                          <List.Item key={p}>{p}</List.Item>
                        ))}
                        {r.problems.length > 4 ? <List.Item>… và {r.problems.length - 4} lỗi khác</List.Item> : null}
                      </List>
                    ) : null}
                  </Paper>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </>
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Huỷ
          </Button>
          <Button disabled={toSave === 0} loading={busy && !!preview} leftSection={<IconCheck size={18} />} onClick={commit}>
            {toSave ? `Nhập ${toSave} bài` : "Nhập"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
