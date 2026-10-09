import { Alert, Anchor, Badge, Grid, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type AuditEntry, type OverviewDay } from "../api";
import { useAuth } from "../auth";
import { ACTIONS, entityLabel, entityPath } from "../history/meta";
import { shortDate, timeAgo } from "../lib";
import { UserAvatar } from "../users/UserBadges";

type Stat = { label: string; value: number; to?: string; warn?: boolean };

export function OverviewPage() {
  const { admin } = useAuth();
  const { data, error, isLoading } = useQuery({ queryKey: ["overview"], queryFn: api.overview });

  const people: Stat[] = data
    ? [
        { label: "Người dùng", value: data.users, to: "/users" },
        { label: "Học hôm nay", value: data.activeToday },
        { label: "Học trong 7 ngày", value: data.activeUsers7Days, to: "/users?filter=active" },
        { label: "Mới trong 7 ngày", value: data.newUsers7Days, to: "/users" },
      ]
    : [];
  const content: Stat[] = data
    ? [
        { label: "Từ vựng", value: data.words, to: "/words" },
        { label: "Bộ từ", value: data.decks, to: "/decks" },
        { label: "Bài ngữ pháp", value: data.grammarLessons, to: "/grammar" },
      ]
    : [];
  const missing: Stat[] = data
    ? [
        { label: "Từ chưa có hình", value: data.wordsMissingImage, to: "/words?missing=image", warn: true },
        { label: "Từ thiếu câu ví dụ", value: data.wordsMissingExample, to: "/words?missing=example", warn: true },
        { label: "Từ thiếu phiên âm", value: data.wordsMissingIpa, to: "/words?missing=ipa", warn: true },
      ]
    : [];

  return (
    <Stack gap="lg" maw={1100}>
      <div>
        <Title order={2}>Tổng quan</Title>
        <Text c="dimmed">Chào {admin?.displayName}, đây là tình hình của 4UME.</Text>
      </div>
      {error ? <Alert color="red">{(error as Error).message}</Alert> : null}

      <StatSection title="Người học" stats={people} loading={isLoading} cols={{ base: 2, sm: 4 }} />

      <Grid gap="md" align="stretch">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card title="14 ngày qua">
            {data ? <ActivityChart days={data.activity} /> : <Skeleton h={180} />}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card
            title="Thay đổi gần đây"
            link={
              <Anchor component={Link} to="/history" fz="sm">
                Xem tất cả
              </Anchor>
            }
          >
            {data ? <RecentChanges items={data.recentChanges} /> : <Skeleton h={180} />}
          </Card>
        </Grid.Col>
      </Grid>

      <StatSection title="Nội dung" stats={content} loading={isLoading} />
      <StatSection title="Cần bổ sung" stats={missing} loading={isLoading} />

      <Card
        title="Người dùng mới"
        link={
          <Anchor component={Link} to="/users" fz="sm">
            Xem tất cả
          </Anchor>
        }
      >
        {data ? (
          data.recentUsers.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
              {data.recentUsers.map((u) => (
                <UnstyledButton key={u.id} component={Link} to={`/users/${u.id}`} p={6} style={{ borderRadius: 8 }}>
                  <Group gap="sm" wrap="nowrap">
                    <UserAvatar user={u} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <Text fz="sm" fw={600} truncate>
                        {u.displayName}
                      </Text>
                      <Text fz="xs" c="dimmed" truncate>
                        {shortDate(u.createdAt)} · {u.email}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          ) : (
            <Text fz="sm" c="dimmed">
              Chưa có người dùng.
            </Text>
          )
        ) : (
          <Skeleton h={90} />
        )}
      </Card>
    </Stack>
  );
}

function Card({ title, link, children }: { title: string; link?: ReactNode; children: ReactNode }) {
  return (
    <Paper p="md" radius="lg" shadow="xs" h="100%">
      <Group justify="space-between" mb="sm">
        <Text fw={700} fz="sm" tt="uppercase" c="dimmed">
          {title}
        </Text>
        {link}
      </Group>
      {children}
    </Paper>
  );
}

function StatSection({
  title,
  stats,
  loading,
  cols = { base: 2, sm: 3 },
}: {
  title: string;
  stats: Stat[];
  loading: boolean;
  cols?: Record<string, number>;
}) {
  return (
    <Stack gap="xs">
      <Text fw={700} fz="sm" tt="uppercase" c="dimmed">
        {title}
      </Text>
      <SimpleGrid cols={cols}>
        {loading ? [0, 1, 2].map((i) => <Skeleton key={i} h={92} radius="lg" />) : stats.map((s) => <StatCard key={s.label} stat={s} />)}
      </SimpleGrid>
    </Stack>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const highlight = stat.warn && stat.value > 0;
  const body = (
    <Paper p="md" radius="lg" shadow="xs" h="100%">
      <Text fz={30} fw={700} c={highlight ? "orange.8" : "brand.7"} lh={1.1}>
        {stat.value.toLocaleString("vi-VN")}
      </Text>
      <Text fz="sm" c="dimmed" mt={4}>
        {stat.label}
      </Text>
    </Paper>
  );
  return stat.to ? (
    <Link to={stat.to} style={{ textDecoration: "none", color: "inherit" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

/** Learners per day as bars; new sign-ups as a small count under each bar. */
function ActivityChart({ days }: { days: OverviewDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.learners));
  const totalNew = days.reduce((s, d) => s + d.newUsers, 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 4, alignItems: "end", height: 150 }}>
        {days.map((d) => {
          const [, m, day] = d.date.split("-");
          const tip = [
            `${day}/${m}: ${d.learners} người học`,
            d.newWords ? `${d.newWords} từ mới` : null,
            d.reviews ? `${d.reviews} lượt ôn` : null,
            d.grammarItems ? `${d.grammarItems} câu ngữ pháp` : null,
            d.newUsers ? `${d.newUsers} người đăng ký` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Tooltip key={d.date} label={tip} withArrow multiline maw={220}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                {d.learners ? (
                  <Text fz={10} ta="center" c="dimmed" lh={1.4}>
                    {d.learners}
                  </Text>
                ) : null}
                <div
                  style={{
                    height: `${Math.max(d.learners ? 6 : 2, (d.learners / max) * 120)}px`,
                    borderRadius: 4,
                    background: d.learners ? "#2F9C77" : "#E1EAE6",
                  }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 4, marginTop: 4 }}>
        {days.map((d, i) => (
          <Text key={d.date} fz={10} c="dimmed" ta="center" style={{ visibility: i % 2 === days.length % 2 ? "hidden" : "visible" }}>
            {Number(d.date.slice(8))}
          </Text>
        ))}
      </div>
      <Group gap="md" mt="xs">
        <Text fz="xs" c="dimmed">
          Cột: số người học mỗi ngày
        </Text>
        <Text fz="xs" c="dimmed">
          Đăng ký mới: <b>{totalNew}</b>
        </Text>
      </Group>
    </div>
  );
}

function RecentChanges({ items }: { items: AuditEntry[] }) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        Chưa có thay đổi nào.
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {items.map((e) => {
        const action = ACTIONS[e.action] ?? { label: e.action, color: "gray" };
        const path = entityPath(e.entityType, e.entityId);
        return (
          <UnstyledButton key={e.id} p={6} style={{ borderRadius: 8 }} onClick={() => path && navigate(path)}>
            <Group gap={6} wrap="nowrap">
              <Badge color={action.color} variant="light" size="xs" style={{ flexShrink: 0 }}>
                {action.label}
              </Badge>
              <Text fz="sm" fw={600} truncate style={{ flex: 1 }}>
                {e.summary}
              </Text>
            </Group>
            <Text fz="xs" c="dimmed">
              {entityLabel(e.entityType)} · {timeAgo(e.at)} · {e.userName}
            </Text>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
