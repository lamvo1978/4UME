# 4UME — UI design (duyệt trước khi code)

Tên app: **4UME**.

## Design tokens

| Token | Giá trị | Ghi chú |
|---|---|---|
| `--bg` | `#E7F2EC` → `#D7E8DF` | Nền mint–sage, gradient nhẹ |
| `--surface` | `#F7FBF8` | Khối nội dung sáng |
| `--ink` | `#1A2E28` | Chữ chính |
| `--muted` | `#5C726A` | Chữ phụ |
| `--accent` | `#0F6B5C` | Teal đậm, CTA |
| `--accent-soft` | `#C8E4DC` | Trạng thái đúng / tiến độ |
| `--danger-soft` | `#E8D4C8` | Nút “Chưa nhớ” (trầm, không đỏ gắt) |
| Font display | Serif rõ nét (Fraunces / tương đương RN) | Tên app **4UME**, từ trên thẻ |
| Font body | Sans đọc tốt (Source Sans 3 / tương đương) | UI tiếng Việt |

Tránh: tím mặc định, glow, dark mode, cụm pill dày, dashboard nhiều thẻ.

## Luồng màn hình

1. Chào / đăng nhập → 2. Trang chủ → 3a. Bộ từ → Flashcard, hoặc 3b. Ngữ pháp → Bài tập → 4. Hồ sơ

## Mock đã xuất

| File | Màn |
|---|---|
| [ui-welcome.png](ui-welcome.png) | Chào + Đăng nhập / Tạo tài khoản |
| [ui-home.png](ui-home.png) | Trang chủ: Từ vựng / Ngữ pháp |
| [ui-decks.png](ui-decks.png) | Danh sách bộ từ + lọc level |
| [ui-flashcard.png](ui-flashcard.png) | Phiên học flashcard |
| [ui-grammar.png](ui-grammar.png) | Bài giảng + câu hỏi |
| [ui-profile.png](ui-profile.png) | Hồ sơ / tiến trình |

## Chỉnh so với mock (khi code)

- **Flashcard**: mặt trước là **từ tiếng Anh + IPA**; chạm mới hiện nghĩa tiếng Việt và ví dụ. Mock có thể hiện ngược — khi làm app giữ thứ tự Anh → Việt.
- **Trang chủ**: giữ đúng 2 lối vào chính (Từ vựng / Ngữ pháp), không thêm lưới thống kê.
- **Tab dưới**: Trang chủ · Học · Hồ sơ.

## Stack gắn với UI

- Mobile: React Native (Expo) đọc các màn trên.
- API .NET 9 + PostgreSQL: đăng nhập, tiến trình từ, điểm ngữ pháp.
- Nội dung từ: `data/vocabulary.json` (đã có).
- Chi tiết hệ thống: [`docs/architecture.md`](../architecture.md).
