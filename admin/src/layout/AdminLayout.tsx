import { AppShell, Avatar, Badge, Group, Indicator, Menu, NavLink, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconDots, IconKey, IconLogout } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { NAV, type NavItem } from "../nav";
import { ACCENT, BG } from "../theme";
import classes from "./AdminLayout.module.css";
import { ChangePasswordModal } from "./ChangePasswordModal";

const isActive = (path: string, to: string) => (to === "/" ? path === "/" : path.startsWith(to));

export function AdminLayout() {
  const { admin, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const desktop = useMediaQuery("(min-width: 64em)", true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const primary = NAV.filter((n) => n.primary);
  const more = NAV.filter((n) => !n.primary);
  const moreActive = more.some((n) => isActive(pathname, n.to));
  const feedbackCounts = useQuery({ queryKey: ["feedback-counts"], queryFn: api.feedbackCounts, refetchInterval: 60_000 });
  const badgeCount = (n: NavItem) => (n.badge === "feedback" ? (feedbackCounts.data?.unread ?? 0) : 0);
  const badge = (n: NavItem) =>
    badgeCount(n) > 0 ? (
      <Badge size="sm" color="red" circle={badgeCount(n) < 10}>
        {badgeCount(n)}
      </Badge>
    ) : null;
  const moreUnread = more.some((n) => badgeCount(n) > 0);

  return (
    <AppShell
      navbar={{ width: 248, breakpoint: "64em", collapsed: { mobile: true } }}
      footer={{ height: 64, collapsed: desktop }}
      padding={{ base: "md", md: "xl" }}
      styles={{ main: { background: BG, minHeight: "100dvh" } }}
    >
      <AppShell.Navbar p="md">
        <Group gap={10} mb="lg" px={6}>
          <img src="/logo-emblem.png" alt="" className={classes.logo} />
          <Text ff="heading" fz={24} fw={700} c={ACCENT}>
            4UME
          </Text>
          <Text fz="xs" c="dimmed" mt={6}>
            Admin
          </Text>
        </Group>
        <Stack gap={4} style={{ flex: 1 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              component={Link}
              to={n.to}
              label={n.label}
              leftSection={<n.icon size={20} stroke={1.7} />}
              rightSection={badge(n)}
              active={isActive(pathname, n.to)}
              className={classes.navLink}
            />
          ))}
        </Stack>
        <Group justify="space-between" wrap="nowrap" pt="md" className={classes.account}>
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
            <Avatar color="brand" radius="xl">
              {admin?.displayName.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Text fz="sm" fw={600} truncate>
                {admin?.displayName}
              </Text>
              <Text fz="xs" c="dimmed" truncate>
                {admin?.email}
              </Text>
            </div>
          </Group>
          <Group gap={2} wrap="nowrap">
            <UnstyledButton onClick={() => setPasswordOpen(true)} aria-label="Đổi mật khẩu" title="Đổi mật khẩu" className={classes.iconBtn}>
              <IconKey size={20} />
            </UnstyledButton>
            <UnstyledButton onClick={logout} aria-label="Đăng xuất" title="Đăng xuất" className={classes.iconBtn}>
              <IconLogout size={20} />
            </UnstyledButton>
          </Group>
        </Group>
      </AppShell.Navbar>

      <AppShell.Main
        // Mantine grows the footer by the iPhone home-indicator inset but not the page padding.
        style={{
          paddingBottom: "calc(var(--app-shell-footer-offset, 0rem) + var(--app-shell-padding) + env(safe-area-inset-bottom))",
        }}
      >
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer className={classes.tabBar}>
        {primary.map((n) => (
          <UnstyledButton
            key={n.to}
            component={Link}
            to={n.to}
            className={classes.tab}
            data-active={isActive(pathname, n.to) || undefined}
          >
            <n.icon size={22} stroke={1.7} />
            <span>{n.label}</span>
          </UnstyledButton>
        ))}
        <Menu position="top-end" width={220} shadow="md">
          <Menu.Target>
            <UnstyledButton className={classes.tab} data-active={moreActive || undefined}>
              <Indicator color="red" size={8} disabled={!moreUnread} offset={2}>
                <IconDots size={22} stroke={1.7} />
              </Indicator>
              <span>Thêm</span>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            {more.map((n) => (
              <Menu.Item key={n.to} leftSection={<n.icon size={18} />} rightSection={badge(n)} onClick={() => navigate(n.to)}>
                {n.label}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<IconKey size={18} />} onClick={() => setPasswordOpen(true)}>
              Đổi mật khẩu
            </Menu.Item>
            <Menu.Item color="red" leftSection={<IconLogout size={18} />} onClick={logout}>
              Đăng xuất
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </AppShell.Footer>

      <ChangePasswordModal opened={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </AppShell>
  );
}
