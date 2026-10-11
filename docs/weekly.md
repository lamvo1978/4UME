# Tổng kết tuần

Nhìn lại một tuần học (thứ Hai – Chủ nhật, theo giờ máy người học): học mấy ngày, bao nhiêu từ mới, lượt ôn, ngữ pháp, bài nghe, từ đọc chuẩn, chuỗi ngày.

## Người học thấy gì

- **Thẻ "Tổng kết tuần qua" trên Trang chủ**, chỉ vào **thứ Hai** (cả ngày), nằm trên thẻ *Mục tiêu hôm nay*:
  - "Bạn học 5/7 ngày · chuỗi 12 ngày", dòng các con số khác 0 ("42 từ mới · 120 lượt ôn · đọc chuẩn 18 từ"), câu so sánh với tuần trước đó, "Xem chi tiết ›".
  - Nút **×** để đóng; đóng rồi thì tuần đó không hiện lại (lưu trên máy, theo từng tài khoản).
  - **Không hiện** khi tuần trước không học ngày nào (không gây áp lực), hoặc khi người học tắt **Tổng kết tuần** trong Cài đặt.
- **Hồ sơ → Tổng kết tuần** (dưới lịch *5 tuần gần đây*): xem bất kỳ lúc nào.
- **Màn chi tiết** (`WeeklyScreen`): mũi tên chuyển tuần (tuần này và tối đa 8 tuần trước, không lùi quá tuần tạo tài khoản), số ngày đã học, biểu đồ cột 7 ngày (ngày giữ chuỗi bằng đóng băng hiện bông tuyết, ngày chưa tới viền nét đứt), 6 ô số liệu.

## Cách tính

| Số liệu | Nguồn |
|---|---|
| Ngày học | `StudyDays` không phải ngày đóng băng |
| Từ mới, lượt ôn từ, lượt ngữ pháp, bài nghe | Cộng các cột của `StudyDays` trong tuần (bài nghe gồm cả chép chính tả, chỉ tính khi admin cho nghe tính vào chuỗi) |
| Từ đọc chuẩn | Số **từ khác nhau** có ít nhất một lần chấm phát âm ≥ 80 điểm trong tuần |
| Chuỗi | Chuỗi ngày vào Chủ nhật của tuần đó; tuần hiện tại là chuỗi hôm nay |

- **So sánh** dùng điểm hoạt động giống lịch Hồ sơ (từ mới + lượt ôn + 3 × ngữ pháp + 3 × bài nghe), chỉ nói điều tích cực: tăng ≥ 10% → "Chăm hơn tuần trước đó n%"; chênh dưới 10% → "Đều đặn như tuần trước đó"; giảm → câu động viên, không nêu con số (tuần đang dở thì không nói gì).
- API: `GET /api/me/weekly?weeks=n` (1–13, mặc định 2) → `{ today, weeks: [...] }`, tuần mới nhất trước.

## Sau này

- Có bản build EAS và thông báo đẩy: gửi thông báo `weekly` vào ngày/giờ trong admin *Thông số hệ thống* (mặc định Chủ nhật 19:00), tôn trọng công tắc *Tổng kết tuần* và giờ yên tĩnh — xem [notifications.md](notifications.md).
