import {
  IconBell,
  IconBook2,
  IconCards,
  IconHistory,
  IconLayoutDashboard,
  IconPhoto,
  IconSettings,
  IconUsers,
  IconWriting,
  type Icon,
} from "@tabler/icons-react";

export type NavItem = { to: string; label: string; icon: Icon; /** shown in the phone tab bar */ primary?: boolean };

export const NAV: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: IconLayoutDashboard, primary: true },
  { to: "/words", label: "Từ vựng", icon: IconBook2, primary: true },
  { to: "/grammar", label: "Ngữ pháp", icon: IconWriting, primary: true },
  { to: "/decks", label: "Bộ từ", icon: IconCards },
  { to: "/images", label: "Hình ảnh", icon: IconPhoto },
  { to: "/history", label: "Lịch sử", icon: IconHistory },
  { to: "/users", label: "Người dùng", icon: IconUsers },
  { to: "/notifications", label: "Thông báo", icon: IconBell },
  { to: "/settings", label: "Cài đặt", icon: IconSettings },
];
