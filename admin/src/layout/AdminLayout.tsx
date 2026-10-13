import { AppShell, Avatar, Badge, Collapse, Group, Indicator, Menu, NavLink, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { IconChevronRight, IconDots, IconKey, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLogout } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { FEEDBACK_POLL_MS } from "../feedback/meta";
import { useAuth } from "../auth";
import { NAV, NAV_GROUPS, type NavGroup, type NavItem } from "../nav";
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
  const [rail, setRail] = useLocalStorage({ key: "admin-nav-rail", defaultValue: false, getInitialValueInEffect: false });
  const [openGroups, setOpenGroups] = useLocalStorage<string[]>({ key: "admin-nav-open-groups", defaultValue: [], getInitialValueInEffect: false });
  const primary = NAV.filter((n) => n.primary);
  const more = NAV.filter((n) => !n.primary);
  const moreActive = more.some((n) => isActive(pathname, n.to));
  const feedbackCounts = useQuery({
    queryKey: ["feedback-counts"],
    queryFn: api.feedbackCounts,
    refetchInterval: FEEDBACK_POLL_MS,
    // Keeps the "(n)" in the browser tab title current while another tab is in front.
    refetchIntervalInBackground: true,
  });
  const unreadFeedback = feedbackCounts.data?.unread ?? 0;

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = unreadFeedback > 0 ? `(${unreadFeedback}) ${base}` : base;
  }, [unreadFeedback]);
  const badgeCount = (n: NavItem) => (n.badge === "feedback" ? unreadFeedback : 0);
  const badge = (n: NavItem) =>
    badgeCount(n) > 0 ? (
      <Badge size="sm" color="red" circle={badgeCount(n) < 10}>
        {badgeCount(n)}
      </Badge>
    ) : null;
  const moreUnread = more.some((n) => badgeCount(n) > 0);
  const groupOpen = (g: NavGroup) => openGroups.includes(g.label!) || g.items.some((n) => isActive(pathname, n.to));
  const toggleGroup = (label: string) =>
    setOpenGroups((open) => (open.includes(label) ? open.filter((l) => l !== label) : [...open, label]));
  const navLink = (n: NavItem) => (
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
  );
  const accountButtons = (
    <>
      <UnstyledButton onClick={() => setPasswordOpen(true)} aria-label="Đổi mật khẩu" title="Đổi mật khẩu" className={classes.iconBtn}>
        <IconKey size={20} />
      </UnstyledButton>
      <UnstyledButton onClick={logout} aria-label="Đăng xuất" title="Đăng xuất" className={classes.iconBtn}>
        <IconLogout size={20} />
      </UnstyledButton>
    </>
  );

  return (
    <AppShell
      navbar={{ width: rail ? 72 : 248, breakpoint: "64em", collapsed: { mobile: true } }}
      footer={{ height: 64, collapsed: desktop }}
      padding={{ base: "md", md: "xl" }}
      styles={{ main: { background: BG, minHeight: "100dvh" } }}
    >
      <AppShell.Navbar p={rail ? "xs" : "md"}>
        <AppShell.Section>
          <Group justify={rail ? "center" : "space-between"} wrap="nowrap" mb="md" px={rail ? 0 : 6}>
            {!rail && (
              <Group gap={10} wrap="nowrap">
                <img src="/logo-emblem.png" alt="" className={classes.logo} />
                <Text ff="heading" fz={24} fw={700} c={ACCENT}>
                  4UME
                </Text>
                <Text fz="xs" c="dimmed" mt={6}>
                  Admin
                </Text>
              </Group>
            )}
            <Tooltip label={rail ? "Mở rộng menu" : "Thu gọn menu"} position="right" withArrow>
              <UnstyledButton onClick={() => setRail((r) => !r)} aria-label={rail ? "Mở rộng menu" : "Thu gọn menu"} className={classes.iconBtn}>
                {rail ? <IconLayoutSidebarLeftExpand size={20} /> : <IconLayoutSidebarLeftCollapse size={20} />}
              </UnstyledButton>
            </Tooltip>
          </Group>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} type="scroll" mx={rail ? -6 : -8} px={rail ? 6 : 8}>
          {rail ? (
            <Stack gap={6}>
              {NAV_GROUPS.map((g, i) =>
                g.label && g.icon ? (
                  <Menu key={g.label} trigger="click-hover" position="right-start" offset={10} width={220} shadow="md" openDelay={80} closeDelay={150}>
                    <Menu.Target>
                      <UnstyledButton
                        aria-label={g.label}
                        className={classes.railItem}
                        data-active={g.items.some((n) => isActive(pathname, n.to)) || undefined}
                      >
                        <Indicator color="red" size={8} disabled={!g.items.some((n) => badgeCount(n) > 0)} offset={2}>
                          <g.icon size={22} stroke={1.7} />
                        </Indicator>
                      </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>{g.label}</Menu.Label>
                      {g.items.map((n) => (
                        <Menu.Item
                          key={n.to}
                          component={Link}
                          to={n.to}
                          leftSection={<n.icon size={18} />}
                          rightSection={badge(n)}
                          className={classes.railMenuItem}
                          data-active={isActive(pathname, n.to) || undefined}
                        >
                          {n.label}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                ) : (
                  g.items.map((n) => (
                    <Tooltip key={n.to ?? i} label={n.label} position="right" withArrow>
                      <UnstyledButton
                        component={Link}
                        to={n.to}
                        aria-label={n.label}
                        className={classes.railItem}
                        data-active={isActive(pathname, n.to) || undefined}
                      >
                        <n.icon size={22} stroke={1.7} />
                      </UnstyledButton>
                    </Tooltip>
                  ))
                ),
              )}
            </Stack>
          ) : (
            NAV_GROUPS.map((g, i) => (
              <Stack key={g.label ?? i} gap={2} mb={6}>
                {g.label && (
                  <UnstyledButton className={classes.groupLabel} onClick={() => toggleGroup(g.label!)} aria-expanded={groupOpen(g)}>
                    <Indicator color="red" size={7} position="middle-end" offset={-12} disabled={groupOpen(g) || !g.items.some((n) => badgeCount(n) > 0)}>
                      <span>{g.label}</span>
                    </Indicator>
                    <IconChevronRight size={14} className={classes.chevron} data-open={groupOpen(g) || undefined} />
                  </UnstyledButton>
                )}
                {g.label ? (
                  <Collapse expanded={groupOpen(g)}>
                    <Stack gap={2}>{g.items.map(navLink)}</Stack>
                  </Collapse>
                ) : (
                  g.items.map(navLink)
                )}
              </Stack>
            ))
          )}
        </AppShell.Section>

        <AppShell.Section pt="md" className={classes.account}>
          {rail ? (
            <Menu position="right-end" offset={10} width={220} shadow="md">
              <Menu.Target>
                <UnstyledButton aria-label="Tài khoản" className={classes.railItem}>
                  <Avatar color="brand" radius="xl">
                    {admin?.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  <Text fz="sm" fw={600} c="dark" truncate>
                    {admin?.displayName}
                  </Text>
                  <Text fz="xs" c="dimmed" truncate>
                    {admin?.email}
                  </Text>
                </Menu.Label>
                <Menu.Divider />
                <Menu.Item leftSection={<IconKey size={18} />} onClick={() => setPasswordOpen(true)}>
                  Đổi mật khẩu
                </Menu.Item>
                <Menu.Item color="red" leftSection={<IconLogout size={18} />} onClick={logout}>
                  Đăng xuất
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Group justify="space-between" wrap="nowrap">
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
                {accountButtons}
              </Group>
            </Group>
          )}
        </AppShell.Section>
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
          <Menu.Dropdown mah="calc(100dvh - 96px)" style={{ overflowY: "auto" }}>
            {NAV_GROUPS.map((g, i) => {
              const items = g.items.filter((n) => !n.primary);
              if (items.length === 0) return null;
              return (
                <div key={g.label ?? i}>
                  {g.label && <Menu.Label>{g.label}</Menu.Label>}
                  {items.map((n) => (
                    <Menu.Item key={n.to} leftSection={<n.icon size={18} />} rightSection={badge(n)} onClick={() => navigate(n.to)}>
                      {n.label}
                    </Menu.Item>
                  ))}
                </div>
              );
            })}
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
