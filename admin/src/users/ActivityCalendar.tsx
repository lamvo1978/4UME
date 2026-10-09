import { Group, Text, Tooltip } from "@mantine/core";
import type { StudyDay } from "../api";
import { dayKey } from "../lib";

const WEEKS = 12;
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const SHADES = ["#EEF3F1", "#BFE3D3", "#7CC5A6", "#2F9C77", "#0F6B5C"];
const FROZEN = "#BCDDF5";

const total = (d: StudyDay) => d.newWords + d.reviews + d.grammarItems;

function shade(d: StudyDay | undefined) {
  if (!d) return SHADES[0];
  if (d.frozen) return FROZEN;
  const n = total(d);
  return n >= 60 ? SHADES[4] : n >= 30 ? SHADES[3] : n >= 10 ? SHADES[2] : SHADES[1];
}

function label(date: Date, d: StudyDay | undefined) {
  const when = date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
  if (!d) return `${when}: không học`;
  if (d.frozen) return `${when}: dùng lượt đóng băng`;
  const parts = [d.newWords && `${d.newWords} từ mới`, d.reviews && `${d.reviews} lượt ôn`, d.grammarItems && `${d.grammarItems} câu ngữ pháp`].filter(Boolean);
  return `${when}: ${parts.join(", ") || "có học"}`;
}

/** Last 12 weeks as a Monday-first grid, one column per week, like a contribution chart. */
export function ActivityCalendar({ days }: { days: StudyDay[] }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - mondayOffset - (WEEKS - 1) * 7);

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + i);
      return date;
    }),
  );

  return (
    <div style={{ maxWidth: 420 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `24px repeat(${WEEKS}, 1fr)`,
          gridTemplateRows: "repeat(7, auto)",
          gridAutoFlow: "column",
          gap: 4,
        }}
      >
        {WEEKDAYS.map((d, i) => (
          <Text key={d} fz={10} c="dimmed" lh={1} style={{ alignSelf: "center", visibility: i % 2 === 0 ? "visible" : "hidden" }}>
            {d}
          </Text>
        ))}
        {columns.flat().map((date) => {
          const future = date > today;
          const d = byDate.get(dayKey(date));
          return (
            <Tooltip key={date.getTime()} label={label(date, d)} disabled={future} withArrow>
              <div
                style={{
                  aspectRatio: "1",
                  borderRadius: 4,
                  background: future ? "transparent" : shade(d),
                  outline: date.getTime() === today.getTime() ? "2px solid #0F6B5C" : undefined,
                  outlineOffset: -2,
                }}
              />
            </Tooltip>
          );
        })}
      </div>
      <Group gap={6} mt="xs">
        <Text fz={11} c="dimmed">
          Ít
        </Text>
        {SHADES.map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
        ))}
        <Text fz={11} c="dimmed">
          Nhiều
        </Text>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: FROZEN, marginLeft: 8 }} />
        <Text fz={11} c="dimmed">
          Đóng băng
        </Text>
      </Group>
    </div>
  );
}
