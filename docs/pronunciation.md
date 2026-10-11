# Kiểm tra giọng đọc

Trong bài **Ôn từ** có thêm loại câu **Đọc to từ này**: người học bấm micro, đọc to từ, 4UME chấm điểm phát âm. Đây cũng là điểm khác biệt đầu tiên giữa gói miễn phí và **Premium**.

## Luồng trong app

- Mỗi phiên ôn có tối đa **2 câu đọc to**, đặt ở nửa sau phiên và ngay sau câu cuối của từ đó (người học vừa ôn xong nghĩa và cách viết).
- Bấm micro → ghi tối đa 4 giây (bấm lần nữa để dừng sớm) → gửi lên máy chủ chấm.
- **Còn lượt chấm chi tiết**: điểm 0–100, điểm từng âm (xanh ≥ 80, cam ≥ 60, đỏ < 60), gợi ý âm sai nhiều nhất, nút nghe lại *Giọng bạn* / *Giọng mẫu*.
- **Đọc lại** cũng tốn một lượt như lần chấm đầu. Người học tự chọn dùng lượt để đọc lại một từ khó hay để chấm từ khác.
- **Hết lượt** (hoặc admin tắt, hoặc hết hạn mức tháng): chế độ **Tự so sánh**. Người học nghe lại giọng mình và giọng mẫu; bên dưới là khung *Chấm chi tiết từng âm* bị khoá, kèm:
  - nút **Xem quảng cáo để chấm bản ghi này** (xem [Quảng cáo đổi lượt chấm](ads.md)): xem hết quảng cáo thì bản ghi vừa đọc được chấm ngay, không phải đọc lại;
  - nút **Xem Premium** (chỉ tài khoản miễn phí, khi dịch vụ chấm đang chạy).
- Ngay sau khi chấm **lượt cuối cùng** trong ngày: dưới kết quả có khung nhắc nhẹ (từ sau sẽ tự so sánh, có thể xem quảng cáo đổi lượt nếu đang bật, Premium có bao nhiêu lượt).
- Dòng trạng thái phía trên micro luôn cho biết: `Chấm chi tiết: còn x/y lượt hôm nay`, `Premium · …` hoặc `Hết lượt … · tự so sánh giọng`. Lượt có được từ quảng cáo cộng vào `y`.
- **Không tiện nói lúc này**: bỏ mọi câu đọc to còn lại của phiên.
- Câu đọc to **không** tính đúng/sai và không ảnh hưởng lịch ôn.

## Lượt và Premium

| | Miễn phí | Premium |
|---|---|---|
| Chấm chi tiết (Azure) | 3 lượt / ngày | 50 lượt / ngày |
| Xem quảng cáo đổi lượt | +1 lượt mỗi quảng cáo, tối đa 10 / ngày | Không có quảng cáo |
| Hết lượt | Tự so sánh giọng | Tự so sánh giọng |

- **Một lượt = một lần chấm**, kể cả đọc lại cùng từ. Mỗi lần chấm ghi một dòng `PronunciationAttempts` (tính lượt trong ngày, phút Azure và hạn mức tháng).
- Số lượt trong ngày = lượt của gói + số quảng cáo đã xem hôm nay. Lượt từ quảng cáo xem trước khi lên Premium vẫn giữ trong ngày đó.
- "Ngày" theo giờ máy người học (header `X-Utc-Offset`), giống chuỗi ngày học.
- Premium do admin bật tay: *Người dùng → chi tiết → thẻ Premium → Bật / Gia hạn (1, 3, 6 tháng, 1 năm) / Tắt*. Gia hạn cộng thêm vào hạn đang có. Chưa có thanh toán trong app.
- Danh sách người dùng có bộ lọc **Premium** và huy hiệu vương miện.
- App: dòng gói ngay dưới tên trên **Hồ sơ** mở màn **Premium** (danh sách quyền lợi sửa trên admin *Quyền lợi Premium*, so sánh lượt chấm, số lượt còn hôm nay). Chưa có nút mua; màn này **không** hướng dẫn thanh toán ngoài app (Apple không cho phép khi bán quyền lợi số mà không qua In‑App Purchase).

## Cài đặt (web admin → Cài đặt → Kiểm tra giọng đọc)

- Bật/tắt câu đọc to trong bài ôn.
- Số lượt chấm mỗi ngày (miễn phí / Premium).
- **Cho xem quảng cáo đổi lượt chấm** (mặc định tắt) và **Quảng cáo tối đa mỗi ngày** (mặc định 10, từ 1 đến 50).
- **Giới hạn phút mỗi tháng** (mặc định 300 phút, khớp hạn mức gói Azure F0 cho nhận dạng giọng nói). Chạm giới hạn thì mọi người chuyển sang tự so sánh tới đầu tháng sau (UTC), và nút quảng cáo cũng ẩn.
- Hiện số lần chấm, số người, số quảng cáo và số phút đã dùng trong tháng. Thay đổi có trong *Lịch sử* và khôi phục được.

## Kỹ thuật

- Chấm điểm: Azure Speech **Pronunciation Assessment** qua REST (short audio), cùng key với giọng đọc Góc nghe: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` → `Speech__Key`, `Speech__Region`. Không có key thì app chỉ có chế độ tự so sánh, admin hiện cảnh báo.
- Điểm hiển thị là **Accuracy** (độ chính xác âm). Không dùng PronScore vì với một từ, độ trôi chảy luôn 100 làm điểm bị đẩy lên.
- Azure khá dễ tính (đọc "sink" cho từ "think" vẫn được khoảng 90), nên điểm từng âm hữu ích hơn điểm tổng.
- Ghi âm: iOS ghi thẳng WAV 16 kHz; Android (m4a) và web (webm) được máy chủ chuyển sang WAV 16 kHz mono bằng **ffmpeg** (đã cài trong image API, `deploy/Dockerfile`). Tối đa 2 MB và 6 giây; dưới 0,3 giây báo ghi lại.
- API: `GET /api/pronunciation/status`, `POST /api/pronunciation/assess` (multipart: `wordId`, `audio`). Hết lượt → 429, tắt hoặc hết hạn mức → 503 (app chuyển sang tự so sánh).
- Admin: `PUT /api/admin/users/{id}/premium` `{ until }` (null = tắt), `PUT /api/admin/settings/pronunciation`, `POST /api/admin/settings/pronunciation/reset`.
- Dữ liệu: cột `Users.PremiumUntil`, bảng `PronunciationAttempts` (mỗi lượt chấm: từ, ngày địa phương, độ dài âm thanh, điểm), migration `Pronunciation`; bảng `AdRewards` (migration `AdRewards`). Cài đặt lưu trong `AppSettings` khoá `pronunciation`.
- App: `mobile/src/components/SpeakExercise.tsx`, chèn câu trong `mobile/src/screens/ReviewScreen.tsx`, dòng gói trên Hồ sơ `mobile/src/components/profile/PlanRow.tsx` mở màn Premium `mobile/src/screens/PremiumScreen.tsx` (ví dụ kết quả chấm, so sánh lượt chấm Miễn phí / Premium, danh sách tính năng luôn miễn phí; chưa có nút đăng ký cho tới khi làm mua trong app). Quyền micro khai báo qua plugin `expo-audio` trong `mobile/app.json`.

## Giai đoạn sau

- Hết lượt: dùng **nhận dạng giọng nói của máy** (`expo-speech-recognition`) để báo đúng/sai cơ bản thay vì chỉ tự so sánh. Cần bản build riêng (development build / EAS Build) vì Expo Go không có module này.
- Thanh toán Premium trong app (In‑App Purchase / Google Play Billing).
- Quảng cáo đổi lượt chấm: phần còn lại khi build bằng EAS ghi trong [ads.md](ads.md).
