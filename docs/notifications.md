# Thông báo nhắc học — kế hoạch

> Trạng thái: **giai đoạn 1 đã xong** (10/2026). Giai đoạn 2 chờ tài khoản Apple / Google; giai đoạn 3 làm cùng web admin.

## Hai loại thông báo

| | Thông báo cục bộ (local) | Thông báo đẩy (push) |
|---|---|---|
| Ai gửi | Điện thoại tự hẹn giờ (như báo thức) | Server gửi qua Apple / Google |
| Cần mạng | Không | Có |
| Cần tài khoản Apple / Google | Không | Có (Apple Developer 99 USD/năm, Google Play 25 USD một lần) |
| Chạy trên Expo Go | Có | Không — cần build app thật bằng EAS |
| Mạnh ở | Đúng giờ, ổn định, riêng tư | Nội dung luôn mới, biết chính xác tình trạng học, gửi được tin chung |
| Yếu ở | Nội dung viết sẵn lúc mở app; hết lịch nếu 7 ngày không mở app | Phụ thuộc server và mạng |

**Hướng chọn: kết hợp cả hai.** Nhắc hằng ngày dùng local; những thông báo cần dữ liệu mới nhất dùng push. Dịch vụ gửi push: **Expo Push Service** (miễn phí, một API cho cả iOS và Android).

## Nguyên tắc chung

- **Tối đa 2 thông báo / ngày** cho mỗi người (không tính tin chung từ admin).
- **Giờ yên tĩnh** (mặc định 22:30 – 07:00): không gửi gì. Chỉnh trong web admin — xem *Thông số hệ thống*.
- **Hôm nay đã học thì không nhắc học nữa** (vẫn có thể nhận tổng kết tuần / tin mới).
- Mỗi loại bật / tắt riêng trong *Hồ sơ → Cài đặt học*.
- Chạm vào thông báo mở thẳng màn liên quan (ôn tập, học từ mới, bài ngữ pháp…).
- Nội dung thay đổi luân phiên, giọng thân thiện, ít emoji; không dọa nạt hay làm người học thấy tội lỗi.

## Các loại thông báo

| Mã | Khi nào | Ví dụ nội dung | Giai đoạn 1 | Giai đoạn 2 |
|---|---|---|---|---|
| `daily` | Giờ người dùng chọn, nếu hôm đó chưa học | "Có 12 từ cần ôn hôm nay · Giữ chuỗi 15 ngày nhé!" | Local | Local (giữ nguyên) |
| `rescue` | Giờ cứu chuỗi (mặc định 22:00, chỉnh trong web admin), nếu đang có chuỗi ≥ 2 và hôm đó chưa học | "Còn 2 tiếng nữa là mất chuỗi 15 ngày 🔥 — 3 phút ôn tập là đủ!" | Local (ước lượng) | Push (chính xác) |
| `comeback` | Sau 3 và 7 ngày không học | "Lâu rồi không gặp! Ôn lại 5 từ cũ trong 2 phút nhé." | Local (ngày 3 và 7) | Push (ngày 3, 7, 14, 30) |
| `freeze` | Sáng hôm sau khi app tự dùng lượt đóng băng | "Hôm qua bạn lỡ học — đã dùng 1 lượt đóng băng để giữ chuỗi 15 ngày." | — | Push |
| `weekly` | Chủ nhật 19:00 | "Tuần này: 52 từ mới, 6/7 ngày học — hơn tuần trước 20%!" | — | Push |
| `news` | Admin gửi từ web admin | "Có 3 bài ngữ pháp mới: câu điều kiện loại 3…" | — | Push |

### Nội dung `daily` theo tình huống

Ưu tiên từ trên xuống, lấy dòng đầu tiên phù hợp:

1. Có từ / bài đến hạn ôn → "Có **N** từ cần ôn hôm nay".
2. Chưa đạt mục tiêu từ mới → "Học **10** từ mới hôm nay nhé".
3. Còn lại → câu khích lệ ngẫu nhiên.

Dòng phụ luôn nhắc chuỗi nếu đang có: "Giữ chuỗi **N** ngày nhé!" / sắp tới mốc: "Còn 2 ngày nữa là đạt mốc 30 ngày!".

## Giai đoạn 1 — làm ngay (chưa cần tài khoản)

### App

- Viết lại `mobile/src/notifications/reminders.ts`:
  - Lịch 7 ngày tới: mỗi ngày tối đa 1 `daily` + 1 `rescue`.
  - Ngày thứ 3 và 7 kể từ lần học cuối: thay nội dung bằng `comeback`.
  - Số từ đến hạn của từng ngày lấy từ API dự báo (xem dưới) để nội dung đúng cho cả những ngày sau.
  - Học xong → lịch được dựng lại (bỏ nhắc của hôm nay), như hiện tại.
- Kho câu nhắc luân phiên (`notifications/copy.ts`), không lặp lại câu của hôm trước.
- Chạm thông báo → mở màn tương ứng (Ôn tập / Học từ mới).
- Cài đặt: thêm công tắc **Nhắc cứu chuỗi** (mặc định bật) bên dưới *Nhắc học hằng ngày*.

### Backend

- `GET /api/review/forecast?days=7` → số từ + bài ngữ pháp đến hạn mỗi ngày (theo giờ địa phương).
- Bảng `AppSettings` (khoá → giá trị) chứa *Thông số hệ thống*, có giá trị mặc định khi chưa ai sửa. `GET /api/config` trả các thông số app cần (giờ cứu chuỗi, giờ yên tĩnh) để app hẹn lịch local theo đúng thông số; app tải lại mỗi lần mở.
- `User`: thêm `NotifyRescue` (mặc định bật), `NotifyWeekly`, `NotifyNews`, `TimeZone` (IANA, ví dụ `Asia/Ho_Chi_Minh`, app tự gửi lên khi mở nếu khác với giá trị đã lưu).
- Làm sẵn nền cho giai đoạn 2 (chưa gửi thật):
  - Bảng `DeviceTokens`: `UserId`, `Token`, `Platform`, `AppVersion`, `CreatedAt`, `LastSeenAt`.
  - `POST /api/me/devices` (đăng ký mã), `DELETE /api/me/devices/{token}` (khi đăng xuất).
  - Bảng `NotificationLogs`: `UserId`, `Kind`, `LocalDate`, `Title`, `Body`, `SentAt`, `Status` — chống gửi trùng (duy nhất theo `UserId + Kind + LocalDate`) và giới hạn 2 / ngày.

## Giai đoạn 2 — khi có tài khoản Apple và Google

### Việc của bạn (mình hướng dẫn từng bước khi tới lúc)

1. Đăng ký **Apple Developer Program** và **Google Play Console**.
2. Tạo tài khoản **Expo** (miễn phí), cài `eas-cli`.
3. Tạo dự án **Firebase** (miễn phí) cho Android, tải `google-services.json` và khoá dịch vụ FCM v1.
4. Tạo khoá **APNs** (.p8) trên trang Apple Developer.
5. Tải 2 khoá trên lên Expo (`eas credentials`).

### App

- Build bằng EAS (bản development để thử, bản production để lên store).
- Sau khi đăng nhập và được cấp quyền: lấy Expo push token → `POST /api/me/devices`. Đăng xuất → xoá token.
- Khi server báo đã bật push (`/api/me` trả `serverPush: true`): app **ngừng hẹn local** cho `rescue` và `comeback` để không bị trùng; `daily` vẫn là local.

### Backend

- Tác vụ nền (`BackgroundService`) chạy mỗi 5 phút:
  - Tìm người dùng đang trong khung giờ cần gửi theo `TimeZone` của họ (`rescue` theo giờ cứu chuỗi, `freeze` 08:00, `weekly` CN 19:00, `comeback` vào giờ nhắc của họ — đều đọc từ *Thông số hệ thống*).
  - Kiểm tra điều kiện (chưa học hôm nay, chuỗi ≥ 2…), giới hạn 2 / ngày, giờ yên tĩnh, công tắc của người dùng.
  - Gửi theo lô 100 qua Expo Push API, ghi `NotificationLogs`.
  - 15 phút sau đọc biên nhận (receipts); token báo `DeviceNotRegistered` → xoá.
- Cấu hình: `Push__ExpoAccessToken` trong `docker-compose.yml` (biến môi trường, không đưa vào git).

## Giai đoạn 3 — trong web admin

Trang **Thông báo** (bổ sung vào [kế hoạch web admin](admin-web.md)):

- Soạn tin `news`: tiêu đề, nội dung, màn sẽ mở khi chạm.
- Chọn người nhận: tất cả / người học trong 7 ngày qua / người lâu không học.
- Gửi ngay hoặc hẹn giờ; xem trước trên khung iPhone / Android.
- Lịch sử: số người nhận, số gửi thành công, số lần chạm mở.
- Thống kê từng loại tự động (`daily`, `rescue`…): đã gửi bao nhiêu, tỉ lệ người học lại trong 2 giờ sau khi nhận.

## Thông số hệ thống (chỉnh trong web admin)

Admin chỉnh trong trang **Cài đặt hệ thống** của [web admin](admin-web.md) (đã làm); áp dụng cho mọi người dùng, không cần cập nhật app. Chưa chỉnh lần nào (hoặc bấm *Khôi phục mặc định*) thì dùng giá trị mặc định.

| Thông số | Mặc định | Ràng buộc |
|---|---|---|
| Giờ cứu chuỗi | 22:00 | Phải trước giờ bắt đầu yên tĩnh |
| Giờ yên tĩnh — bắt đầu | 22:30 | |
| Giờ yên tĩnh — kết thúc | 07:00 | Giờ nhắc người dùng chọn nằm trong khung yên tĩnh sẽ được dời ra ngoài khung |
| Số thông báo tối đa / ngày | 2 | 1 – 3 |
| Chuỗi tối thiểu để gửi cứu chuỗi | 2 ngày | |
| Ngày gửi nhắc quay lại | 3, 7 (local) · 3, 7, 14, 30 (push) | |
| Giờ tổng kết tuần | Chủ nhật 19:00 | |
| Giờ báo dùng lượt đóng băng | 08:00 | |

## Để làm sau

- **Thông báo sắp đạt mốc** (ví dụ "Còn 1 ngày nữa là đạt mốc 30 ngày!") — tạm thời chỉ ghép vào dòng phụ của `daily`; sẽ quyết định có tách thành loại riêng hay không sau.
