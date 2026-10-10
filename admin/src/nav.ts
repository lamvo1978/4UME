import {
  IconBell,
  IconBook2,
  IconCards,
  IconHeadphones,
  IconHistory,
  IconInfoCircle,
  IconLayoutDashboard,
  IconPhoto,
  IconPhotoSearch,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconWriting,
  type Icon,
} from "@tabler/icons-react";

export type NavItem = { to: string; label: string; icon: Icon; /** shown in the phone tab bar */ primary?: boolean };

export const NAV: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: IconLayoutDashboard, primary: true },
  { to: "/words", label: "Từ vựng", icon: IconBook2, primary: true },
  { to: "/grammar", label: "Ngữ pháp", icon: IconWriting, primary: true },
  { to: "/listening", label: "Bài nghe", icon: IconHeadphones },
  { to: "/decks", label: "Bộ từ", icon: IconCards },
  { to: "/image-assign", label: "Gắn ảnh", icon: IconPhotoSearch },
  { to: "/images", label: "Hình ảnh", icon: IconPhoto },
  { to: "/history", label: "Lịch sử", icon: IconHistory },
  { to: "/users", label: "Người dùng", icon: IconUsers },
  { to: "/notifications", label: "Thông báo", icon: IconBell },
  { to: "/premium", label: "Quyền lợi Premium", icon: IconSparkles },
  { to: "/about", label: "Giới thiệu app", icon: IconInfoCircle },
  { to: "/settings", label: "Cài đặt", icon: IconSettings },
];
