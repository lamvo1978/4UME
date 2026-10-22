export const ENTITY_TYPES = [
  { value: "word", label: "Từ vựng" },
  { value: "deck", label: "Bộ từ" },
  { value: "grammar", label: "Ngữ pháp" },
  { value: "listening", label: "Bài nghe" },
  { value: "placement", label: "Kiểm tra đầu vào" },
  { value: "sentence", label: "Luyện câu" },
  { value: "conversation", label: "Đàm thoại AI" },
  { value: "writing", label: "Luyện viết AI" },
  { value: "media", label: "Hình ảnh" },
  { value: "user", label: "Người dùng" },
  { value: "settings", label: "Cài đặt" },
  { value: "partner", label: "Đối tác" },
  { value: "broadcast", label: "Gửi thông báo" },
];

export const WEEKDAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

export const entityLabel = (type: string) => ENTITY_TYPES.find((t) => t.value === type)?.label ?? type;

export const ACTIONS: Record<string, { label: string; color: string }> = {
  create: { label: "Thêm", color: "green" },
  update: { label: "Sửa", color: "blue" },
  delete: { label: "Xoá", color: "red" },
  restore: { label: "Khôi phục", color: "violet" },
  import: { label: "Nhập file", color: "cyan" },
  reorder: { label: "Đổi thứ tự", color: "gray" },
  generate: { label: "Tạo âm thanh", color: "teal" },
};

/** Where the entity is edited; null when it has no page of its own. */
export function entityPath(type: string, id: string) {
  if (id === "*") return type === "deck" ? "/decks" : type === "grammar" ? "/grammar" : type === "listening" ? "/listening" : null;
  switch (type) {
    case "word":
      return `/words/${encodeURIComponent(id)}`;
    case "grammar":
      return `/grammar/${id}`;
    case "listening":
      return `/listening/${id}`;
    case "deck":
      return "/decks";
    case "placement":
      return "/placement";
    case "sentence":
      return "/sentences";
    case "conversation":
      return "/conversation";
    case "writing":
      return "/writing";
    case "media":
      return "/images";
    case "user":
      return `/users/${id}`;
    case "partner":
      return `/partners/${id}`;
    case "broadcast":
      return "/broadcasts";
    case "settings":
      return id === "about"
        ? "/about"
        : id === "premium"
          ? "/premium"
          : id === "feedback"
            ? "/feedback/settings"
            : id === "notificationTexts"
              ? "/notifications"
              : id === "conversation" || id === "writing"
                ? `/${id}`
                : "/settings";
    default:
      return null;
  }
}

/** Snapshot keys shown in the diff, in display order. Keys not listed are skipped. */
export const FIELD_LABELS: Record<string, Record<string, string>> = {
  word: {
    word: "Từ",
    pos: "Loại từ",
    level: "Cấp độ",
    deckId: "Bộ",
    meaningVi: "Nghĩa",
    ipa: "Phiên âm",
    example: "Câu ví dụ",
    exampleVi: "Nghĩa câu ví dụ",
    imageUrl: "Hình",
    published: "Hiện trong app",
  },
  deck: { titleVi: "Tên bộ", icon: "Biểu tượng", published: "Hiện trong app" },
  grammar: {
    titleVi: "Tên bài",
    titleEn: "Tên tiếng Anh",
    level: "Cấp độ",
    summaryVi: "Tóm tắt",
    quizSize: "Số câu mỗi lượt",
    published: "Hiện trong app",
    version: "Phiên bản",
  },
  listening: {
    titleEn: "Tên tiếng Anh",
    titleVi: "Tên bài",
    kind: "Thể loại",
    level: "Cấp độ",
    topic: "Chủ đề",
    summaryVi: "Tóm tắt",
    published: "Hiện trong app",
    version: "Phiên bản",
  },
  writing: {
    titleVi: "Tiêu đề",
    level: "Cấp độ",
    promptEn: "Đề bài",
    guideVi: "Hướng dẫn",
    minWords: "Số từ tối thiểu",
    maxWords: "Số từ tối đa",
    keyPhrases: "Cụm từ gợi ý",
    published: "Hiện trong app",
  },
  media: { originalName: "Tên file", url: "Đường dẫn", width: "Rộng", height: "Cao", bytes: "Dung lượng" },
  user: { email: "Email", displayName: "Tên", role: "Quyền", locked: "Bị khoá", premiumUntil: "Premium đến" },
  settings: {
    rescueTime: "Giờ cứu chuỗi",
    quietStart: "Bắt đầu yên tĩnh",
    quietEnd: "Kết thúc yên tĩnh",
    maxPerDay: "Tối đa mỗi ngày",
    rescueMinStreak: "Chuỗi tối thiểu để cứu",
    comebackDaysLocal: "Nhắc quay lại (trên máy)",
    comebackDaysPush: "Nhắc quay lại (từ server)",
    weeklyDay: "Ngày tổng kết tuần",
    weeklyTime: "Giờ tổng kết tuần",
    freezeNoticeTime: "Giờ báo đóng băng",
    countsTowardStreak: "Nghe xong tính vào chuỗi ngày",
    enabled: "Đang bật",
    codePrefix: "Tiền tố mã mời",
    freeDailyLimit: "Số lượt chấm miễn phí mỗi ngày",
    premiumDailyLimit: "Số lượt chấm Premium mỗi ngày",
    attemptsPerWord: "Số lần chấm mỗi từ",
    monthlyMinutesCap: "Giới hạn phút Azure mỗi tháng",
    paidMonthlyMinutesCap: "Phút trả phí tối đa mỗi tháng",
    adRewardsEnabled: "Xem quảng cáo đổi lượt chấm",
    adRewardsPerDay: "Số quảng cáo tối đa mỗi ngày",
    tagline: "Câu giới thiệu",
    sections: "Các mục",
    perks: "Quyền lợi",
    plans: "Bảng giá",
    showPrices: "Hiện bảng giá trong app",
    recipients: "Email nhận góp ý",
    replies: "Câu trả lời mẫu",
    dailyLimit: "Góp ý mới tối đa mỗi ngày",
    autoCloseDays: "Tự đóng sau (ngày)",
    requiredStudyDays: "Bạn mới cần học (ngày)",
    rewardDays: "Thưởng mỗi bên (ngày Premium)",
    maxRewardsPerUser: "Thưởng tối đa mỗi người mời",
    joinWindowDays: "Hạn nhập mã mời (ngày)",
    dueTitles: "Nhắc học · có bài cần ôn",
    newWordsTitles: "Nhắc học · còn từ mới",
    encouragementTitles: "Nhắc học · đã xong mục tiêu",
    startStreakLines: "Dòng phụ · chưa có chuỗi",
    streakLines: "Dòng phụ · đang có chuỗi",
    milestoneTomorrow: "Dòng phụ · mai đạt mốc",
    milestoneSoon: "Dòng phụ · sắp đạt mốc",
    rescueFreezeTitle: "Cứu chuỗi · tiêu đề khi còn đóng băng",
    rescueFreezeBodies: "Cứu chuỗi · nội dung khi còn đóng băng",
    rescueTitles: "Cứu chuỗi · tiêu đề",
    rescueBodies: "Cứu chuỗi · nội dung",
    comebackTitles: "Quay lại học · tiêu đề",
    comebackDueBody: "Quay lại học · có từ cần ôn",
    comebackNewBody: "Quay lại học · không có từ cần ôn",
    weeklyTitle: "Tổng kết tuần · tiêu đề",
    weeklyBody: "Tổng kết tuần · nội dung",
    feedbackReplyTitle: "Trả lời góp ý · tiêu đề",
    feedbackReplyBody: "Trả lời góp ý · nội dung",
    promptTitle: "Hỏi bật nhắc học · tiêu đề",
    promptBody: "Hỏi bật nhắc học · nội dung",
    freeDailyChecks: "Bài chấm miễn phí mỗi ngày",
    premiumDailyChecks: "Bài chấm Premium mỗi ngày",
    dailyTotalCap: "Trần tổng bài chấm mỗi ngày",
    premiumReservePercent: "Phần để dành Premium (%)",
    rewritePremiumOnly: "Bản viết lại chỉ cho Premium",
    freeHistoryCount: "Bài lịch sử gói miễn phí",
    providers: "Thứ tự AI chấm",
    premiumProviders: "Thứ tự AI chấm · Premium",
  },
  partner: { name: "Tên đối tác", prefix: "Tiền tố mã", features: "Tính năng mở", note: "Ghi chú" },
  broadcast: {
    title: "Tiêu đề",
    body: "Nội dung",
    screen: "Mở khi chạm",
    audience: "Người nhận",
    scheduledAt: "Thời điểm gửi",
    status: "Trạng thái",
  },
};
