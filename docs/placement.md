# Kiểm tra trình độ từ vựng

Người học mới làm một bài trắc nghiệm ngắn để 4UME biết nên bắt đầu dạy từ cấp nào (A1–B2), tránh bắt người đã biết học lại từ quá dễ.

## Luồng

1. **Tạo tài khoản xong** → màn *Bạn biết bao nhiêu từ tiếng Anh?* (không có nút quay lại):
   - **Bắt đầu kiểm tra** (2–3 phút), hoặc
   - **Tôi mới bắt đầu học** → cấp A1, vào thẳng app.
2. **Người dùng cũ chưa có cấp**: Trang chủ có thẻ *Kiểm tra trình độ từ vựng* (không bắt buộc).
3. **Hồ sơ → Cài đặt (bánh răng) → Cài đặt học → Trình độ từ vựng**: đổi cấp A1–B2, đổi cách xử lý từ dễ, nút *Kiểm tra* / *Kiểm tra lại*.

## Bài kiểm tra

- Mỗi câu: một từ tiếng Anh (kèm phiên âm, nút nghe) + 4 nghĩa tiếng Việt + nút **Không biết**.
- Câu hỏi lấy ngẫu nhiên từ kho từ vựng đang hiện (danh từ, động từ, tính từ, trạng từ). 3 đáp án nhiễu cùng cấp, cùng từ loại; chỉ hiện **nghĩa đầu tiên** để đáp án đúng không dài hơn hẳn các đáp án khác.
- Thích ứng: bắt đầu A1, mỗi cấp tối đa 6 câu — **đúng 5 → lên cấp**, **sai 2 → dừng**. Tối đa khoảng 24 câu.
- Kết quả = cấp đầu tiên chưa vượt qua (vượt hết thì B2). Người học vẫn chọn được cấp khác ở màn kết quả.

## Từ dễ hơn cấp bắt đầu

| Chế độ | Ý nghĩa |
|---|---|
| **Bỏ qua** (mặc định) | Từ dưới cấp vẫn là *từ mới* nhưng xếp **cuối** mỗi bộ từ (sau từ đúng cấp). Không ảnh hưởng thống kê. |
| **Tính là đã nhớ** | Từ dưới cấp chưa học được đánh dấu *đã nhớ* (cấp ôn 6), lần ôn đầu rải ngẫu nhiên trong **30–365 ngày** để mỗi ngày chỉ thêm vài từ vào Ôn tập. |

- Từ do bài kiểm tra đánh dấu có cờ `FromPlacement`: **không** tính vào "Đã nhớ … từ", số từ đang ôn, độ nhớ trong Hồ sơ. Khi người học tự học / ôn từ đó, cờ được xoá và từ thành tiến độ thật.
- Đổi cấp, đổi chế độ hoặc làm lại bài: xoá các từ còn cờ `FromPlacement` rồi áp dụng lại. Từ người học tự học hoặc đã ôn **giữ nguyên**. App hỏi xác nhận trước khi đánh dấu / bỏ đánh dấu.
- Danh sách bộ từ (tab Học) mặc định lọc theo cấp của người học; vẫn chọn được *Tất cả*.

## Kỹ thuật

- API: `GET /api/placement/questions` (8 câu mỗi cấp, app dùng tối đa 6), `POST /api/placement/apply` `{ level, mode: "skip" | "known", tested }`.
- Cột mới: `Users.VocabLevel`, `Users.EasyWordMode`, `Users.PlacementTakenAt`, `WordProgresses.FromPlacement` (migration `Placement`).
- App: `mobile/src/screens/PlacementScreen.tsx`, logic thích ứng `mobile/src/vocabulary/placement.ts`.
