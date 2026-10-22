import {
  IconAdjustments,
  IconBallpen,
  IconBell,
  IconBook2,
  IconBooks,
  IconSpeakerphone,
  IconUsersGroup,
  IconBuildingCommunity,
  IconCards,
  IconClipboardCheck,
  IconHeadphones,
  IconHistory,
  IconInfoCircle,
  IconLayoutDashboard,
  IconMessageChatbot,
  IconMessageCircle,
  IconMessages,
  IconPhoto,
  IconPhotoSearch,
  IconSend,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconWriting,
  type Icon,
} from "@tabler/icons-react";

export type NavItem = {
  to: string;
  label: string;
  icon: Icon;
  /** shown in the phone tab bar */
  primary?: boolean;
  /** live count shown next to the label */
  badge?: "feedback";
};

export type NavGroup = {
  /** omitted for the top group */
  label?: string;
  /** stands for the whole group in the collapsed sidebar */
  icon?: Icon;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: "/", label: "Tổng quan", icon: IconLayoutDashboard, primary: true }] },
  {
    label: "Nội dung",
    icon: IconBooks,
    items: [
      { to: "/words", label: "Từ vựng", icon: IconBook2, primary: true },
      { to: "/grammar", label: "Ngữ pháp", icon: IconWriting, primary: true },
      { to: "/listening", label: "Bài nghe", icon: IconHeadphones },
      { to: "/sentences", label: "Luyện câu", icon: IconMessages },
      { to: "/conversation", label: "Đàm thoại AI", icon: IconMessageChatbot },
      { to: "/writing", label: "Luyện viết AI", icon: IconBallpen },
      { to: "/placement", label: "Kiểm tra đầu vào", icon: IconClipboardCheck },
      { to: "/decks", label: "Bộ từ", icon: IconCards },
      { to: "/image-assign", label: "Gắn ảnh", icon: IconPhotoSearch },
      { to: "/images", label: "Hình ảnh", icon: IconPhoto },
    ],
  },
  {
    label: "Người dùng",
    icon: IconUsersGroup,
    items: [
      { to: "/users", label: "Người dùng", icon: IconUsers },
      { to: "/partners", label: "Đối tác", icon: IconBuildingCommunity },
      { to: "/feedback", label: "Góp ý", icon: IconMessageCircle, badge: "feedback" },
    ],
  },
  {
    label: "Thông báo",
    icon: IconSpeakerphone,
    items: [
      { to: "/notifications", label: "Thông báo", icon: IconBell },
      { to: "/broadcasts", label: "Gửi thông báo", icon: IconSend },
    ],
  },
  {
    label: "Hệ thống",
    icon: IconAdjustments,
    items: [
      { to: "/premium", label: "Quyền lợi Premium", icon: IconSparkles },
      { to: "/about", label: "Giới thiệu app", icon: IconInfoCircle },
      { to: "/history", label: "Lịch sử", icon: IconHistory },
      { to: "/settings", label: "Cài đặt", icon: IconSettings },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
