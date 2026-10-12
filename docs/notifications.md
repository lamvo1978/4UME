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
- Mỗi loại bật / tắt riêng trong *Hồ sơ → Cài đặt (bánh răng) → Cài đặt học*.
- Nhắc học mặc định tắt. Sau bảng mừng chuỗi ngày học đầu tiên (mỗi máy chỉ một lần, khi nhắc học đang tắt và máy còn cho xin quyền), app hỏi *"Giữ lửa mỗi ngày nhé?"* — bấm **Bật nhắc học** thì xin quyền thông báo và bật `daily`.
- Chạm vào thông báo mở thẳng màn liên quan (ôn tập, học từ mới, bài ngữ pháp…).
- Nội dung thay đổi luân phiên, giọng thân thiện, ít emoji; không dọa nạt hay làm người học thấy tội lỗi.

## Các loại thông báo

| Mã | Khi nào | Ví dụ nội dung | Giai đoạn 1 | Giai đoạn 2 |
|---|---|---|---|---|
| `daily` | Giờ người dùng chọn, nếu hôm đó chưa học | "Có 12 từ cần ôn hôm nay · Giữ chuỗi 15 ngày nhé!" | Local | Local (giữ nguyên) |
| `rescue` | Giờ cứu chuỗi (mặc định 22:00, chỉnh trong web admin), nếu đang có chuỗi ≥ 2 và hôm đó chưa học | "Còn 2 tiếng nữa là mất chuỗi 15 ngày 🔥 — 3 phút ôn tập là đủ!" | Local (ước lượng) | Push (chính xác) |
| `comeback` | Sau 3 và 7 ngày không học | "Lâu rồi không gặp! Ôn lại 5 từ cũ trong 2 phút nhé." | Local (ngày 3 và 7) | Push (ngày 3, 7, 14, 30) |
| `freeze` | Sáng hôm sau khi app tự dùng lượt đóng băng | "Hôm qua bạn lỡ học — đã dùng 1 lượt đóng băng để giữ chuỗi 15 ngày." | — | Push |
| `weekly` | Thứ Hai 08:30, nếu tuần trước có học | "Tuần qua: 52 từ mới, 6/7 ngày học — hơn tuần trước đó 20%!" — bấm mở màn *Tổng kết tuần* ([weekly.md](weekly.md)) | — | Push |
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
- Kho câu nhắc luân phiên, không lặp lại câu của hôm trước. Nội dung sửa ở web admin, mục **Thông báo** (khoá `notificationTexts` trong `AppSettings`, có lịch sử và khôi phục mặc định), trả về app qua `GET /api/config` → `notificationTexts`. Chữ trong ngoặc nhọn (`{streak}`, `{count}`…) do app thay bằng số thật; server chỉ nhận đúng các chỗ trống của từng loại câu. App giữ bản mặc định trong `notifications/copy.ts` để dùng khi server cũ hoặc không tải được.
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

## Giai đoạn 2 — thông báo đẩy từ máy chủ (đã làm, iOS trước)

Máy chủ chỉ gửi những gì lịch trên máy không làm được; nhắc học, cứu chuỗi và quay lại học ở các mốc *trên máy* (3, 7 ngày) vẫn do app tự hẹn, nên không bị trùng.

| Loại | Khi nào | Điều kiện | Chạm mở |
|---|---|---|---|
| `weekly` | Ngày + giờ tổng kết tuần (mặc định thứ Hai 08:30) theo giờ của người dùng | Bật *Tổng kết tuần*; tuần trước (thứ Hai – Chủ nhật) có học ít nhất 1 ngày | `Weekly` của tuần trước |
| `comeback` | Giờ nhắc học của người dùng (dời ra khỏi giờ yên tĩnh như app) | Bật *Nhắc học*; số ngày từ lần học cuối nằm trong *Ngày nhắc quay lại (từ server)* nhưng không có trong mốc *trên máy* (mặc định 14, 30) | Ôn tập nếu có từ đến hạn, không thì Học |
| `feedback` | Ngay khi admin trả lời góp ý | Không gửi trong giờ yên tĩnh của người dùng (vẫn thấy chấm đỏ trong app) | Đúng góp ý đó |
| `test` | Admin bấm **Gửi thông báo thử** ở trang người dùng | Không theo giờ yên tĩnh hay công tắc | — |

- Nội dung `weekly`, `comeback`, `feedback` sửa ở web admin, mục **Thông báo**.
- **App** (từ build 3): khi đã được cho phép thông báo, lấy Expo push token → `POST /api/me/devices` (mỗi lần mở app, và khi bật nhắc học). Đăng xuất → `DELETE /api/me/devices/{token}`. Công tắc **Tổng kết tuần** trong Cài đặt.
- **Backend:** `PushScheduler` chạy mỗi 5 phút, gọi `PushNotifier.RunScheduledAsync`: tính giờ địa phương theo `User.TimeZone` (thiếu thì giờ Việt Nam), gửi trong 60 phút sau giờ hẹn. Trước khi gửi ghi một dòng `NotificationLogs` (duy nhất theo người dùng + loại + ngày) nên mỗi loại chỉ đi một lần mỗi ngày; `weekly` + `comeback` cộng lại không quá *Số thông báo tối đa / ngày*. Gửi qua Expo Push API (`ExpoPushClient`); Expo báo `DeviceNotRegistered` thì xoá mã máy đó. `feedback` và `test` không ghi log.
- Cấu hình (`Push__…`, không bắt buộc): `ExpoAccessToken` chỉ cần khi bật *Enhanced security for push* trong dự án Expo; `SchedulerEnabled=false` để tắt lịch gửi.

### Việc của bạn

- **iOS:** khoá APNs do EAS giữ. Lúc chạy `eas build -p ios` lần tới, khi được hỏi về Push Notifications thì chọn **Yes** để EAS tự tạo khoá; hoặc làm trước bằng `npx eas-cli credentials` → iOS → production → Push Notifications.
- **Android (sau khi Google Play xong):** tạo dự án Firebase, thêm `google-services.json` vào app, tải khoá FCM v1 lên EAS (`eas credentials`).

### Để làm sau

- `rescue`/`freeze` từ máy chủ (khi đó app ngừng hẹn local các loại này), đọc biên nhận (receipts) sau 15 phút.

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
| Giờ tổng kết tuần | Thứ Hai 08:30 | |
| Giờ báo dùng lượt đóng băng | 08:00 | |

## Để làm sau

- **Thông báo sắp đạt mốc** (ví dụ "Còn 1 ngày nữa là đạt mốc 30 ngày!") — tạm thời chỉ ghép vào dòng phụ của `daily`; sẽ quyết định có tách thành loại riêng hay không sau.
