import { Alert, Badge, Button, Group, Loader, Modal, Pagination, Paper, Skeleton, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconExternalLink, IconRestore } from "@tabler/icons-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuditEntry } from "../api";
import { fullTime, notifyError, notifySaved, timeAgo } from "../lib";
import { AuditDiff } from "./AuditDiff";
import { ACTIONS, entityLabel, entityPath } from "./meta";

const PAGE_SIZE = 30;

type Props = {
  entityType?: string;
  entityId?: string;
  q?: string;
  /** Called after a restore so an open editor can reload the entity. */
  onRestored?: () => void;
};

/** Paged audit entries; each one expands to its diff and a restore button. */
export function HistoryList({ entityType, entityId, q, onRestored }: Props) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const filters = { entityType, entityId, q, page, pageSize: PAGE_SIZE };
  const list = useQuery({ queryKey: ["audit", filters], queryFn: () => api.audit(filters), placeholderData: keepPreviousData });
  const scoped = !!entityId;

  if (list.isLoading) {
    return (
      <Stack gap="xs">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={60} radius="md" />
        ))}
      </Stack>
    );
  }
  if (list.error) return <Alert color="red">{(list.error as Error).message}</Alert>;
  const data = list.data!;
  if (data.items.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Chưa có thay đổi nào được ghi lại.
      </Text>
    );
  }
  const pages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <Stack gap="xs" style={{ opacity: list.isFetching ? 0.7 : 1 }}>
      {data.items.map((entry, i) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          scoped={scoped}
          current={scoped && page === 1 && i === 0 && entry.action !== "delete"}
          open={open === entry.id}
          onToggle={() => setOpen(open === entry.id ? null : entry.id)}
          onRestored={onRestored}
        />
      ))}
      {pages > 1 ? (
        <Group justify="center" mt="xs">
          <Pagination total={pages} value={page} onChange={setPage} siblings={0} />
        </Group>
      ) : null}
    </Stack>
  );
}

function EntryRow({
  entry,
  scoped,
  current,
  open,
  onToggle,
  onRestored,
}: {
  entry: AuditEntry;
  scoped: boolean;
  current: boolean;
  open: boolean;
  onToggle: () => void;
  onRestored?: () => void;
}) {
  const action = ACTIONS[entry.action] ?? { label: entry.action, color: "gray" };
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["audit-entry", entry.id], queryFn: () => api.auditEntry(entry.id), enabled: open });
  const [confirm, setConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const path = entityPath(entry.entityType, entry.entityId);

  async function restore() {
    setRestoring(true);
    try {
      await api.restoreAudit(entry.id);
      notifySaved(entry.action === "delete" ? "Đã khôi phục" : "Đã quay về bản này");
      setConfirm(false);
      await Promise.all(
        ["audit", "words", "word", "decks", "meta", "grammar", "listening", "overview", "settings", "about"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onRestored?.();
    } catch (e) {
      notifyError(e);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Paper radius="lg" shadow="xs" withBorder={open} style={{ borderColor: open ? "#0F6B5C" : undefined, overflow: "hidden" }}>
      <UnstyledButton w="100%" p="sm" onClick={onToggle}>
        <Group gap="sm" wrap="nowrap" align="flex-start">
          {open ? <IconChevronDown size={18} style={{ marginTop: 3 }} /> : <IconChevronRight size={18} style={{ marginTop: 3 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="wrap">
              <Badge color={action.color} variant="light" size="sm">
                {action.label}
              </Badge>
              {!scoped ? (
                <Badge color="gray" variant="outline" size="sm">
                  {entityLabel(entry.entityType)}
                </Badge>
              ) : null}
              {current ? (
                <Badge color="brand" variant="filled" size="sm">
                  Bản hiện tại
                </Badge>
              ) : null}
              <Text fw={700} fz="sm" truncate style={{ maxWidth: "100%" }}>
                {entry.summary}
              </Text>
            </Group>
            <Text fz="xs" c="dimmed" mt={2}>
              <Tooltip label={fullTime(entry.at)}>
                <span>{timeAgo(entry.at)}</span>
              </Tooltip>{" "}
              · {entry.userName}
              {!scoped && entry.entityId !== "*" && !["media", "user", "settings"].includes(entry.entityType) ? ` · ${entry.entityId}` : ""}
            </Text>
          </div>
        </Group>
      </UnstyledButton>

      {open ? (
        <Stack p="sm" pt={0} gap="sm">
          {detail.isLoading ? <Loader size="sm" /> : null}
          {detail.data ? <AuditDiff detail={detail.data} /> : null}
          {detail.data ? (
            <Group gap="sm" justify="flex-end">
              {!scoped && path && (detail.data.exists || entry.entityId === "*") ? (
                <Button component={Link} to={path} variant="default" size="sm" leftSection={<IconExternalLink size={16} />}>
                  Mở
                </Button>
              ) : null}
              {entry.restorable && !current ? (
                <Button size="sm" variant="light" leftSection={<IconRestore size={16} />} onClick={() => setConfirm(true)}>
                  {entry.action === "delete" ? (detail.data.exists ? "Ghi đè bằng bản đã xoá" : "Khôi phục") : "Quay về bản này"}
                </Button>
              ) : null}
            </Group>
          ) : null}
        </Stack>
      ) : null}

      <Modal opened={confirm} onClose={() => setConfirm(false)} title={entry.action === "delete" ? "Khôi phục mục đã xoá?" : "Quay về bản này?"}>
        <Stack>
          <Text fz="sm">
            {entry.action === "delete"
              ? `"${entry.summary}" sẽ được tạo lại với nội dung lúc bị xoá.`
              : `Nội dung hiện tại của "${entry.summary}" sẽ được thay bằng bản lúc ${fullTime(entry.at)}. Bản hiện tại vẫn nằm trong lịch sử nên có thể quay lại.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirm(false)}>
              Huỷ
            </Button>
            <Button loading={restoring} leftSection={<IconRestore size={18} />} onClick={restore}>
              Khôi phục
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
