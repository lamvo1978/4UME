import { Image, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { mediaSrc, type AboutSection, type AuditDetail, type PremiumPerk } from "../api";
import { sectionLabel } from "../grammar/meta";
import { kindLabel } from "../listening/meta";
import { posLabel } from "../lib";
import { FIELD_LABELS, WEEKDAY_NAMES } from "./meta";

type Snapshot = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function format(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (key === "pos" && typeof value === "string") return posLabel(value);
  if (key === "bytes" && typeof value === "number") return `${Math.round(value / 1024)} KB`;
  if (key === "role") return value === "admin" ? "Quản trị" : "Người học";
  if (key === "kind" && typeof value === "string") return kindLabel(value);
  if (key === "weeklyDay" && typeof value === "number") return WEEKDAY_NAMES[value] ?? String(value);
  if (key === "sections" && Array.isArray(value)) return aboutSections(value as AboutSection[]);
  if (key === "perks" && Array.isArray(value)) return premiumPerks(value as PremiumPerk[]);
  if (Array.isArray(value)) return value.length ? `ngày ${value.join(", ")}` : "tắt";
  return String(value);
}

/** One line per About section: title, visibility and its items (hidden ones marked). */
function aboutSections(sections: AboutSection[]): string {
  if (!sections.length) return "—";
  return sections
    .map((s) => {
      const items = s.items.map((i) => (i.visible ? i.title : `${i.title} (ẩn)`)).join(", ");
      return `${s.title}${s.visible ? "" : " (ẩn)"}: ${items}`;
    })
    .join("\n");
}

/** One line per perk, with its "Sắp có" / hidden flags. */
function premiumPerks(perks: PremiumPerk[]): string {
  if (!perks.length) return "—";
  return perks.map((p) => `${p.title}${p.soon ? " (sắp có)" : ""}${p.visible ? "" : " (ẩn)"}`).join("\n");
}

/** Field-by-field view of an audit entry: changed fields for edits, all fields for creations and deletions. */
export function AuditDiff({ detail }: { detail: AuditDetail }) {
  const type = detail.entry.entityType;
  const labels = FIELD_LABELS[type] ?? {};
  const before = detail.before;
  const after = detail.after;

  if (!before && !after) {
    return (
      <Text fz="sm" c="dimmed">
        Không có nội dung chi tiết cho thao tác này.
      </Text>
    );
  }

  const single = !before || !after;
  const snapshot = (after ?? before) as Snapshot;
  const keys = Object.keys(labels).filter((k) => (single ? k in snapshot : !same(before[k], after[k])));
  const grammarNotes = type === "grammar" ? grammarChanges(before, after) : type === "listening" ? listeningChanges(before, after) : [];

  if (!single && keys.length === 0 && grammarNotes.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        Không có thay đổi nội dung.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {keys.map((k) =>
        single ? (
          <div key={k}>
            <Text fz="xs" fw={700} c="dimmed" tt="uppercase">
              {labels[k]}
            </Text>
            <Value field={k} value={snapshot[k]} />
          </div>
        ) : (
          <div key={k}>
            <Text fz="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
              {labels[k]}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <Paper p="xs" radius="md" bg="#FDECEC">
                <Text fz={11} c="red.8" fw={700}>
                  Trước
                </Text>
                <Value field={k} value={before[k]} />
              </Paper>
              <Paper p="xs" radius="md" bg="#E6F4EC">
                <Text fz={11} c="green.8" fw={700}>
                  Sau
                </Text>
                <Value field={k} value={after[k]} />
              </Paper>
            </SimpleGrid>
          </div>
        ),
      )}
      {grammarNotes.map((n) => (
        <Text key={n} fz="sm">
          • {n}
        </Text>
      ))}
    </Stack>
  );
}

function Value({ field, value }: { field: string; value: unknown }) {
  if ((field === "imageUrl" || field === "url") && typeof value === "string" && value) {
    return <Image src={mediaSrc(value)} w={72} h={72} radius="sm" fit="cover" alt="" mt={4} />;
  }
  const text = format(field, value);
  return (
    <Text fz="sm" c={text === "—" ? "dimmed" : undefined} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {text}
    </Text>
  );
}

type Line = { speaker: string; en: string; vi: string };

/** Plain-language summary of script changes inside a listening snapshot. */
function listeningChanges(before: Snapshot | null, after: Snapshot | null): string[] {
  const bl = (before?.lines as Line[] | undefined) ?? [];
  const al = (after?.lines as Line[] | undefined) ?? [];
  if (!before || !after) return [`${al.length || bl.length} câu trong script.`];

  const notes: string[] = [];
  if (!same(before.speakers, after.speakers)) notes.push("Người đọc / giọng đọc đã thay đổi.");
  const edited = al.map((l, i) => (i < bl.length && !same(l, bl[i]) ? i + 1 : null)).filter(Boolean);
  const parts: string[] = [];
  if (edited.length) parts.push(`sửa câu ${edited.slice(0, 8).join(", ")}${edited.length > 8 ? "…" : ""}`);
  if (al.length > bl.length) parts.push(`thêm ${al.length - bl.length} câu`);
  if (al.length < bl.length) parts.push(`bỏ ${bl.length - al.length} câu`);
  if (parts.length) notes.push(`Script: ${parts.join("; ")}.`);
  return notes;
}

type Section = { type: string; title?: string | null };
type Exercise = { id: string };

/** Plain-language summary of theory / exercise changes inside a lesson snapshot. */
function grammarChanges(before: Snapshot | null, after: Snapshot | null): string[] {
  const bs = (before?.sections as Section[] | undefined) ?? [];
  const as = (after?.sections as Section[] | undefined) ?? [];
  const be = (before?.exercises as Exercise[] | undefined) ?? [];
  const ae = (after?.exercises as Exercise[] | undefined) ?? [];

  if (!before || !after) {
    const s = after ? as : bs;
    const e = after ? ae : be;
    return [`${s.length} khối lý thuyết, ${e.length} câu bài tập.`];
  }

  const notes: string[] = [];
  const sectionParts: string[] = [];
  const edited = as
    .map((s, i) => (i < bs.length && !same(s, bs[i]) ? `khối ${i + 1} (${s.title || sectionLabel(s.type)})` : null))
    .filter(Boolean);
  if (edited.length) sectionParts.push(`sửa ${edited.join(", ")}`);
  if (as.length > bs.length) sectionParts.push(`thêm ${as.length - bs.length} khối`);
  if (as.length < bs.length) sectionParts.push(`bỏ ${bs.length - as.length} khối`);
  if (sectionParts.length) notes.push(`Lý thuyết: ${sectionParts.join("; ")}.`);

  const beforeById = new Map(be.map((e) => [e.id, e]));
  const afterIds = new Set(ae.map((e) => e.id));
  const added = ae.filter((e) => !beforeById.has(e.id)).map((e) => e.id);
  const removed = be.filter((e) => !afterIds.has(e.id)).map((e) => e.id);
  const changed = ae.filter((e) => beforeById.has(e.id) && !same(e, beforeById.get(e.id))).map((e) => e.id);
  const exerciseParts: string[] = [];
  if (added.length) exerciseParts.push(`thêm ${added.join(", ")}`);
  if (changed.length) exerciseParts.push(`sửa ${changed.join(", ")}`);
  if (removed.length) exerciseParts.push(`xoá ${removed.join(", ")}`);
  if (!added.length && !removed.length && !changed.length && !same(be.map((e) => e.id), ae.map((e) => e.id)))
    exerciseParts.push("đổi thứ tự câu");
  if (exerciseParts.length) notes.push(`Bài tập: ${exerciseParts.join("; ")}.`);
  return notes;
}
