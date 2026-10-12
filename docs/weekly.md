# Tổng kết tuần

Nhìn lại một tuần học (thứ Hai – Chủ nhật, theo giờ máy người học): học mấy ngày, bao nhiêu từ mới, lượt ôn, ngữ pháp, bài nghe, từ đọc chuẩn, chuỗi ngày.

## Người học thấy gì

- **Hồ sơ → Tổng kết tuần** (dưới dòng gói / *Thêm lượt kiểm tra*): "Tuần này đã học 3/4 ngày · xem các tuần trước", mở màn chi tiết bất kỳ lúc nào.
- **Thông báo sáng thứ Hai** mở thẳng màn tổng kết của tuần vừa qua (xem *Sau này*). Trang chủ không có thẻ tổng kết.
- **Màn chi tiết** (`WeeklyScreen`): mũi tên chuyển tuần (tuần này và tối đa 8 tuần trước, không lùi quá tuần tạo tài khoản), số ngày đã học kèm chuỗi, biểu đồ cột 7 ngày (ngày giữ chuỗi bằng đóng băng hiện bông tuyết, ngày chưa tới viền nét đứt), 6 ô số liệu: từ mới, lượt ôn từ, lượt ngữ pháp, bài nghe hết, câu chép chính tả, từ đọc chuẩn.

## Cách tính

| Số liệu | Nguồn |
|---|---|
| Ngày học | `StudyDays` không phải ngày đóng băng |
| Từ mới, lượt ôn từ, lượt ngữ pháp | Cộng các cột của `StudyDays` trong tuần |
| Bài nghe hết, câu chép chính tả | Bảng `ListeningLogs` (migration `ListeningLogs`): mỗi lần nghe hết một bài / mỗi câu chép chính tả được kiểm tra ghi một dòng theo ngày địa phương, **luôn ghi** dù công tắc *nghe tính vào chuỗi* bật hay tắt. Lúc tạo bảng đã điền sẵn mỗi bài từng nghe hết một dòng vào ngày nghe hết lần đầu (giờ Việt Nam) |
| Từ đọc chuẩn | Số **từ khác nhau** có ít nhất một lần chấm phát âm ≥ 80 điểm trong tuần |
| Chuỗi | Chuỗi ngày vào Chủ nhật của tuần đó; tuần hiện tại là chuỗi hôm nay (hiện dưới số ngày học) |

- Khi admin **tắt** *nghe tính vào chuỗi*, màn tổng kết hiện ghi chú: nghe hết bài chưa tính vào chuỗi nên ngày chỉ nghe không có cột; chép chính tả vẫn tính. Bật công tắc thì ghi chú tự ẩn (API trả `listensCountTowardStreak`).

- **So sánh** dùng điểm hoạt động giống lịch Hồ sơ (từ mới + lượt ôn + 3 × ngữ pháp + 3 × bài nghe), chỉ nói điều tích cực: tăng ≥ 10% → "Chăm hơn tuần trước đó n%"; chênh dưới 10% → "Đều đặn như tuần trước đó"; giảm → câu động viên, không nêu con số (tuần đang dở thì không nói gì).
- API: `GET /api/me/weekly?weeks=n` (1–13, mặc định 2) → `{ today, weeks: [...] }`, tuần mới nhất trước.

## Sau này

- (Làm ở đợt build EAS, bằng thông báo đẩy từ máy chủ để có số liệu thật.) Thông báo `weekly` **thứ Hai 08:30**, nội dung kiểu "Tuần qua bạn học 5/7 ngày, 42 từ mới", bấm vào mở `Weekly` với `start` = thứ Hai tuần trước. Chỉ gửi khi tuần trước có học ít nhất một ngày, tôn trọng công tắc *Tổng kết tuần* và giờ yên tĩnh — xem [notifications.md](notifications.md). Ngày/giờ đặt trong admin *Thông số hệ thống*.
