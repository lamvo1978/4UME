# Mời bạn bè và mã trung tâm đối tác

Một ô **Nhập mã** trong app nhận cả hai loại mã; máy chủ tự nhận ra mã nào là mã nào (mã mời 6 ký tự, mã trung tâm 8 ký tự dạng `AB-K7P2X9`). Chữ hoa/thường, dấu cách và dấu gạch ngang đều được bỏ qua. Phần ngẫu nhiên của cả hai loại mã dùng bảng chữ không có 0/O, 1/I/L để đọc hay chép tay không nhầm.

## Người học thấy gì (app)

- **Hồ sơ → Mời bạn bè** (dưới *Tổng kết tuần*):
  - mã mời riêng, nút **Gửi mã cho bạn bè** (khung chia sẻ của máy, kèm link `https://4ume.io.vn/moi/?ma=MÃ`);
  - ô **Nhập mã**: mã mời của bạn bè hoặc mã do trung tâm cấp;
  - danh sách bạn đã mời, mỗi người "Đã học x/3 ngày" hoặc "Đã nhận thưởng";
  - số lần đã nhận thưởng / tối đa.
- Học viên trung tâm: khung vàng "Học viên *tên trung tâm*", dòng gói ở Hồ sơ và màn Premium ghi "Học viên *tên* · đến *ngày*" (hoặc "· không thời hạn"). Nếu đang có Premium riêng, màn Premium ghi thêm số ngày đang tạm dừng.
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

- Admin **Đối tác** → *Thêm đối tác*: tên (học viên thấy trong app), **tiền tố mã** 2 chữ cái (không trùng đối tác khác, cố định khi đã có mã), tính năng mở thêm (hiện có *IELTS*), ghi chú nội bộ.
- Mã trung tâm = tiền tố + **6 chữ và số ngẫu nhiên**, ví dụ `AB-K7P2X9` (31 ký tự → khoảng 887 triệu tổ hợp mỗi tiền tố); cả 8 ký tự là duy nhất toàn hệ thống. Ngẫu nhiên (không đánh số liên tiếp) để học viên không đoán được mã của bạn khác.
- Trong trang đối tác: **Tạo mã** theo lô (tên lô, ví dụ lớp/khoá; tối đa 500 mã mỗi lần; **ngày hết hạn** tuỳ chọn, bỏ trống = không thời hạn) → lọc theo lô / trạng thái → **Xuất Excel** để gửi trung tâm. Một lô có một ngày hết hạn; chọn lô ở bộ lọc rồi bấm *Hạn lô* để đổi (gia hạn lô đã hết hạn sẽ mở lại cho học viên trong lô). Hết hạn tính đến hết ngày đã chọn, giờ Việt Nam.
- Mỗi mã **dùng một lần**. Người nhập mã là học viên: Premium và tính năng của đối tác **đến hết hạn lô**, hoặc đến khi admin **thu hồi** mã (trong trang đối tác, hoặc thẻ *Mời bạn & mã trung tâm* ở trang người dùng). Thu hồi xong có thể khôi phục.
- Tài khoản nào cũng nhập được (mới hay cũ, Free hay Premium); tài khoản giữ nguyên. **Premium riêng được tạm dừng** trong lúc học ở trung tâm: phần còn lại được giữ trên mã (`PartnerCodes.HeldPremium`), ngày thưởng mời bạn hoặc admin cấp trong thời gian này cũng cộng vào phần giữ. Khi mã hết hạn hoặc bị thu hồi, phần giữ được trả lại tính từ lúc mã kết thúc. Không cần job chạy nền: mỗi lần đọc quyền lợi (`/api/me`, phát âm…) và mỗi thao tác của admin đều tự đồng bộ (`PremiumHold` trong `Entitlements.cs`).
- Mã chưa dùng mà bị thu hồi hoặc hết hạn thì không nhập được nữa. Xoá tài khoản thì mã đã dùng được thu hồi (dừng tính phí) và vẫn tính là đã dùng.
- Mọi thao tác (thêm/sửa đối tác, tạo lô, đổi hạn lô, thu hồi/khôi phục) ghi vào **Lịch sử**, mục *Đối tác*.

### Thống kê tháng và tính phí trung tâm

Trang đối tác có thẻ **Thống kê tháng** (chọn tháng, xuất Excel gửi trung tâm): mọi học viên còn dùng mã trong tháng, ngày bắt đầu/kết thúc và số tháng tính phí. Danh sách đối tác hiện số tháng phí của tháng hiện tại.

Quy tắc (giờ Việt Nam): mỗi nửa tháng (ngày 1–15, ngày 16–cuối tháng) có dùng thì tính **1/2 tháng**. Nghĩa là bắt đầu ngày 1–15 tính trọn tháng, bắt đầu từ ngày 16 tính 1/2 tháng; tháng kết thúc thì kết thúc ngày 1–15 tính 1/2, từ ngày 16 tính trọn. Không thu hồi thì học viên vẫn được tính phí các tháng sau.

Premium hiệu lực = `PremiumUntil` còn hạn **hoặc** có mã trung tâm đang dùng (chưa thu hồi, chưa hết hạn). `/api/me` trả `premium`, `features` (vd `["ielts"]`), `partnerName`, `partnerUntil`; `/api/pronunciation/status` trả thêm `partnerName`, `partnerUntil`, `pausedPremiumDays`. Bộ lọc *Premium* ở trang người dùng của admin cũng tính cả học viên trung tâm.

## API

| Đường dẫn | Ai | Việc |
| --- | --- | --- |
| `GET /api/me/referral` | người học | mã mời, link, cấu hình, danh sách đã mời |
| `POST /api/codes/redeem` `{ code }` | người học | nhập mã mời hoặc mã trung tâm |
| `GET/POST /api/admin/partners`, `GET/PUT /api/admin/partners/{id}` | admin | đối tác |
| `POST /api/admin/partners/{id}/codes` `{ batch, count, expiresAt }` | admin | tạo lô mã |
| `PUT /api/admin/partners/{id}/batch-expiry` `{ batch, expiresAt }` | admin | đổi hạn cả lô |
| `GET /api/admin/partners/{id}/billing?month=yyyy-MM` | admin | thống kê tháng |
| `PUT /api/admin/partner-codes/{id}/revoked` `{ revoked }` | admin | thu hồi / khôi phục |
| `PUT /api/admin/settings/referral`, `POST …/reset` | admin | cấu hình mời bạn |

## Lưu ý khi lên App Store

Mã mở quyền lợi trả phí là chỗ Apple soi kỹ (Guideline 3.1.1). Cách làm hiện tại:

- Mã **miễn phí**: trung tâm cấp cho học viên của họ, không bán mã; app **không** nói chỗ mua mã hay chỉ ra web để trả tiền.
- Học viên trung tâm thuộc dạng truy cập cho tổ chức/giáo dục (3.1.3).
- Khi nộp duyệt, ghi trong *App Review Notes*: "Premium hiện chỉ được tặng (admin cấp, mời bạn bè, mã miễn phí do trung tâm đối tác cấp cho học viên). App chưa bán gì." Kèm một mã trung tâm thử nếu người duyệt muốn xem phần IELTS.
- Khi bật mua Premium trong app (IAP), giữ nguyên: mã chỉ tặng, không bán.
