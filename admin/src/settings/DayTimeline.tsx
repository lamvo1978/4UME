import { Box, Group, Text } from "@mantine/core";
import type { NotificationConfig } from "../api";
import { toMinutes } from "./notificationRules";

const DAY = 24 * 60;
const pct = (m: number) => `${(m / DAY) * 100}%`;

/** A 24-hour strip: quiet hours shaded, with markers for the server-side send times. */
export function DayTimeline({ config }: { config: NotificationConfig }) {
  const qs = toMinutes(config.quietStart);
  const qe = toMinutes(config.quietEnd);
  const quiet: [number, number][] =
    qs === null || qe === null || qs === qe ? [] : qs < qe ? [[qs, qe]] : [[qs, DAY], [0, qe]];
  const markers = [
    { at: toMinutes(config.rescueTime), label: "Cứu chuỗi", color: "#E8590C" },
    { at: toMinutes(config.freezeNoticeTime), label: "Báo đóng băng", color: "#1C7ED6" },
    { at: toMinutes(config.weeklyTime), label: "Tổng kết tuần", color: "#7048E8" },
  ].filter((m): m is { at: number; label: string; color: string } => m.at !== null);

  return (
    <div>
      <Box pos="relative" h={28} style={{ borderRadius: 8, background: "#E6F4EC", overflow: "hidden" }}>
        {quiet.map(([a, b]) => (
          <div
            key={a}
            style={{ position: "absolute", top: 0, bottom: 0, left: pct(a), width: pct(b - a), background: "#3B4A45", opacity: 0.85 }}
          />
        ))}
        {markers.map((m) => (
          <div
            key={m.label}
            title={`${m.label} ${String(Math.floor(m.at / 60)).padStart(2, "0")}:${String(m.at % 60).padStart(2, "0")}`}
            style={{ position: "absolute", top: 3, bottom: 3, left: pct(m.at), width: 4, marginLeft: -2, borderRadius: 2, background: m.color }}
          />
        ))}
      </Box>
      <Group justify="space-between" mt={4}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Text key={h} fz={10} c="dimmed">
            {h}h
          </Text>
        ))}
      </Group>
      <Group gap="md" mt={6}>
        <Legend color="#3B4A45" label={`Yên tĩnh ${config.quietStart}–${config.quietEnd}`} />
        {markers.map((m) => (
          <Legend key={m.label} color={m.color} label={m.label} />
        ))}
      </Group>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <Text fz="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}
