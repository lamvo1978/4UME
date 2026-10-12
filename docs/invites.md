# Mời bạn bè và mã trung tâm đối tác

Một ô **Nhập mã** trong app nhận cả hai loại mã; máy chủ tự nhận ra mã nào là mã nào (mã mời 6 ký tự, mã trung tâm 8 ký tự dạng `ABCD-EFGH`). Chữ hoa/thường, dấu cách và dấu gạch ngang đều được bỏ qua. Bảng chữ không có 0/O, 1/I/L để đọc hay chép tay không nhầm.

## Người học thấy gì (app)

- **Hồ sơ → Mời bạn bè** (dưới *Tổng kết tuần*):
  - mã mời riêng, nút **Gửi mã cho bạn bè** (khung chia sẻ của máy, kèm link `https://4ume.io.vn/moi/?ma=MÃ`);
  - ô **Nhập mã**: mã mời của bạn bè hoặc mã do trung tâm cấp;
  - danh sách bạn đã mời, mỗi người "Đã học x/3 ngày" hoặc "Đã nhận thưởng";
  - số lần đã nhận thưởng / tối đa.
- Học viên trung tâm: khung vàng "Học viên *tên trung tâm*", dòng gói ở Hồ sơ và màn Premium ghi "Học viên *tên* · không thời hạn".
- Tính năng ẩn **IELTS**: thêm mục *IELTS* cạnh *Từ vựng | Ngữ pháp* ở tab **Học**, chỉ hiện với học viên của đối tác có bật IELTS. Hiện là trang giới thiệu bốn kỹ năng "Sắp có"; nội dung làm sau.
- Trang web `site/moi/`: hiện mã từ đường dẫn, nút chép mã và cách nhận quà. Chưa mở thẳng app (cần universal link ở bản build EAS).

## Mời bạn bè

1. Mỗi tài khoản có một mã mời, tạo lần đầu mở màn *Mời bạn bè* (`Users.ReferralCode`).
2. Bạn mới nhập mã trong **14 ngày** đầu sau khi tạo tài khoản; mỗi tài khoản chỉ nhập một mã mời.
3. Khi bạn mới có đủ **3 ngày học** (ngày đóng băng không tính), cả hai được cộng **7 ngày Premium** vào `PremiumUntil` (cộng tiếp sau hạn hiện tại, hoặc từ hôm nay nếu đã hết hạn).
4. Người mời nhận thưởng tối đa **10 lần**; quá số đó bạn mới vẫn được thưởng.

Chống lạm dụng:

- Mọi tài khoản đều đã xác minh email lúc đăng ký (mã gửi qua email).
- Không nhập được mã của chính mình, không mời ngược (A mời B thì B không nhập được mã của A).
- Chỉ tài khoản mới (trong hạn nhập mã) mới nhập được, nên tài khoản cũ không đổi mã cho nhau được.
- Mỗi tài khoản (hoặc IP) nhập mã tối đa 10 lần / 15 phút.

Kiểm tra thưởng chạy ở lần học đầu tiên mỗi ngày (`ActivityService.RecordAsync` → `ReferralService.OnStudyDayAsync`), và ngay lúc nhập mã nếu bạn mới đã đủ ngày.

Các con số trên chỉnh ở **Cài đặt → Mời bạn bè** trong admin (`AppSettings` khoá `referral`), có lịch sử và khôi phục như các mục cài đặt khác. Tắt chương trình thì app không nhận mã mời mới và không trao thưởng; ngày Premium đã trao vẫn giữ.

## Mã trung tâm đối tác

- Admin **Đối tác** → *Thêm đối tác*: tên (học viên thấy trong app), tính năng mở thêm (hiện có *IELTS*), ghi chú nội bộ.
- Trong trang đối tác: **Tạo mã** theo lô (tên lô, ví dụ lớp/khoá; tối đa 500 mã mỗi lần) → lọc theo lô / trạng thái → **Xuất Excel** để gửi trung tâm.
- Mỗi mã **dùng một lần**. Người nhập mã là học viên: **Premium không thời hạn** và mở tính năng của đối tác, cho đến khi admin **thu hồi** mã (trong trang đối tác, hoặc thẻ *Mời bạn & mã trung tâm* ở trang người dùng). Thu hồi xong có thể khôi phục.
- Thu hồi chỉ bỏ quyền lợi từ trung tâm; ngày Premium có từ nguồn khác (admin cấp, mời bạn) vẫn giữ.
- Mã chưa dùng mà bị thu hồi thì không nhập được nữa. Xoá tài khoản thì mã đã dùng vẫn tính là đã dùng.
- Mọi thao tác (thêm/sửa đối tác, tạo lô, thu hồi/khôi phục) ghi vào **Lịch sử**, mục *Đối tác*.

Premium hiệu lực = `PremiumUntil` còn hạn **hoặc** có mã trung tâm đang dùng (`Infrastructure/Invites/Entitlements.cs`). `/api/me` trả `premium`, `features` (vd `["ielts"]`) và `partnerName`; `/api/pronunciation/status` trả thêm `partnerName`. Bộ lọc *Premium* ở trang người dùng của admin cũng tính cả học viên trung tâm.

## API

| Đường dẫn | Ai | Việc |
| --- | --- | --- |
| `GET /api/me/referral` | người học | mã mời, link, cấu hình, danh sách đã mời |
| `POST /api/codes/redeem` `{ code }` | người học | nhập mã mời hoặc mã trung tâm |
| `GET/POST /api/admin/partners`, `GET/PUT /api/admin/partners/{id}` | admin | đối tác |
| `POST /api/admin/partners/{id}/codes` `{ batch, count }` | admin | tạo lô mã |
| `PUT /api/admin/partner-codes/{id}/revoked` `{ revoked }` | admin | thu hồi / khôi phục |
| `PUT /api/admin/settings/referral`, `POST …/reset` | admin | cấu hình mời bạn |

## Lưu ý khi lên App Store

Mã mở quyền lợi trả phí là chỗ Apple soi kỹ (Guideline 3.1.1). Cách làm hiện tại:

- Mã **miễn phí**: trung tâm cấp cho học viên của họ, không bán mã; app **không** nói chỗ mua mã hay chỉ ra web để trả tiền.
- Học viên trung tâm thuộc dạng truy cập cho tổ chức/giáo dục (3.1.3).
- Khi nộp duyệt, ghi trong *App Review Notes*: "Premium hiện chỉ được tặng (admin cấp, mời bạn bè, mã miễn phí do trung tâm đối tác cấp cho học viên). App chưa bán gì." Kèm một mã trung tâm thử nếu người duyệt muốn xem phần IELTS.
- Khi bật mua Premium trong app (IAP), giữ nguyên: mã chỉ tặng, không bán.
