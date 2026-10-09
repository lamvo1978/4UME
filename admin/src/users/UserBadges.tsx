import { Avatar, Badge, Group, Text, Tooltip } from "@mantine/core";
import { IconFlame, IconLock, IconShieldCheck } from "@tabler/icons-react";
import type { AdminUser } from "../api";

const COLORS = ["teal", "blue", "grape", "orange", "cyan", "pink", "indigo", "lime"];

export function UserAvatar({ user, size = 40 }: { user: Pick<AdminUser, "displayName" | "email">; size?: number }) {
  const name = user.displayName || user.email;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const color = COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <Avatar size={size} radius="xl" color={color} variant="light">
      {initials}
    </Avatar>
  );
}

export function Streak({ value }: { value: number }) {
  return (
    <Tooltip label="Chuỗi ngày học hiện tại">
      <Group gap={2} wrap="nowrap" c={value > 0 ? "orange.7" : "gray.5"}>
        <IconFlame size={16} />
        <Text fz="sm" fw={700}>
          {value}
        </Text>
      </Group>
    </Tooltip>
  );
}

/** Role and lock state; plain learners show nothing. */
export function UserBadges({ user }: { user: Pick<AdminUser, "role" | "lockedAt"> }) {
  if (user.role !== "admin" && !user.lockedAt) return null;
  return (
    <Group gap={4} wrap="nowrap">
      {user.role === "admin" ? (
        <Badge color="brand" variant="light" size="sm" leftSection={<IconShieldCheck size={12} />}>
          Quản trị
        </Badge>
      ) : null}
      {user.lockedAt ? (
        <Badge color="red" variant="light" size="sm" leftSection={<IconLock size={12} />}>
          Đã khoá
        </Badge>
      ) : null}
    </Group>
  );
}
