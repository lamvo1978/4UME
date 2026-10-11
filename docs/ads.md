# Quảng cáo đổi lượt chấm

Người dùng miễn phí hết lượt chấm phát âm trong ngày có thể **tự chọn** xem một quảng cáo có thưởng (rewarded ad) để được chấm thêm **1 lượt**. Mục tiêu là có thêm doanh thu trả chi phí Azure và VPS mà không làm phiền người học.

## Nguyên tắc

- **Tự nguyện**: không có quảng cáo tự bật. Nút chỉ hiện trong khung *Chấm chi tiết từng âm* khi đã hết lượt, và người học phải tự bấm.
- **1 quảng cáo xem hết = 1 lượt chấm**, tối đa **10 quảng cáo mỗi ngày** (admin chỉnh được).
- Xem xong thì **bản ghi vừa đọc được chấm ngay**, không phải đọc lại.
- **Premium không thấy quảng cáo.** Lượt có được từ quảng cáo trước khi lên Premium vẫn giữ đến hết ngày.
- Không quảng cáo xen giữa bài học, bài ôn, bài nghe hay chép chính tả.
- Lượt chỉ được cộng khi **máy chủ nhận xác nhận có chữ ký của Google** (server-side verification), không tin vào app, nên không thể gian lận bằng cách sửa app.

## Đã làm

- Backend:
  - Bảng `AdRewards`: người dùng, ngày địa phương, mã giao dịch AdMob (duy nhất, chống cộng trùng khi Google gửi lại), nguồn `admob` / `dev`.
  - `GET /api/ads/admob-reward`: URL nhận xác nhận của AdMob. Kiểm tra chữ ký ECDSA bằng khoá công khai Google (`verifier-keys.json`, lưu đệm 24 giờ, tải lại khi gặp khoá mới). Đọc `user_id` (id người học) và `custom_data` (ngày trên máy người học, `yyyy-MM-dd`). Chữ ký đúng thì luôn trả 200 để AdMob không gửi lại; chỉ cộng lượt khi đang bật, chưa quá 10/ngày, không phải Premium.
  - `POST /api/ads/dev-reward`: **chỉ có ở môi trường Development** (docker compose local), giả lập một quảng cáo đã xem để thử luồng trên Expo Go.
  - Trạng thái `GET /api/pronunciation/status` có thêm `adsWatchedToday`, `adsLeftToday` (0 khi Premium, khi tắt quảng cáo, hoặc khi dịch vụ chấm tạm dừng).
- Admin → Cài đặt → Kiểm tra giọng đọc: công tắc **Cho xem quảng cáo đổi lượt chấm** (mặc định **tắt**), **Quảng cáo tối đa mỗi ngày**, số quảng cáo đã xem trong tháng.
- App: nút trong `SpeakExercise.tsx`, gọi qua `mobile/src/ads/rewarded.ts`. Hiện tại chỉ bản dev hiện nút (gọi endpoint giả lập); bản phát hành không hiện nút cho tới khi có SDK.

## Còn lại khi build bằng EAS

1. Tạo tài khoản **AdMob**, thêm app iOS + Android, tạo 2 **Rewarded ad unit**.
2. Trong mỗi ad unit bật **Server-side verification**, URL: `https://api.4ume.io.vn/api/ads/admob-reward`, bấm *Verify URL* (máy chủ trả 200).
3. Cài `react-native-google-mobile-ads` (cần development build, Expo Go không chạy được), khai báo App ID trong `app.json`.
4. Thay phần thân `rewarded.ts`:
   - `rewardedAdsSupported()` trả `true` khi SDK sẵn sàng.
   - `watchRewardedAd()`: tải `RewardedAd` với `serverSideVerificationOptions: { userId, customData: localDate() }`, hiện quảng cáo, khi có sự kiện nhận thưởng thì hỏi lại `/api/pronunciation/status` vài lần (mỗi 1 giây, tối đa ~8 giây) cho tới khi `adsWatchedToday` tăng. Người học đóng sớm thì báo lỗi nhẹ, không cộng lượt.
   - Dùng ad unit thử nghiệm của Google khi chạy dev.
5. Đồng ý quyền riêng tư:
   - iOS: hộp thoại **App Tracking Transparency** (`expo-tracking-transparency`) và khai báo `NSUserTrackingUsageDescription`.
   - Hộp thoại đồng ý **UMP** của Google (bắt buộc ở EU/UK, nên bật cho mọi nơi).
   - Khai báo quảng cáo trong App Privacy (App Store) và Data safety (Google Play).
   - AdMob: chặn nhóm quảng cáo không hợp (hẹn hò, cờ bạc, rượu…); đặt mức nội dung phù hợp mọi lứa tuổi.
6. Thử bằng quảng cáo thử nghiệm trên máy thật, rồi mới bật công tắc trong admin.

## Câu chữ cần sửa khi bật quảng cáo

Trang chủ `site/index.html` (đoạn nói về quảng cáo) hiện ghi "Nếu có quảng cáo, đó chỉ là một banner nhỏ…" và "Không quảng cáo bật toàn màn hình, không video bắt phải xem hết." Đề xuất thay bằng:

> 4UME không chèn quảng cáo vào bài học. Khi hết lượt chấm phát âm miễn phí trong ngày, bạn có thể tự chọn xem một quảng cáo ngắn để được chấm thêm một lượt. Không xem cũng không sao, bạn vẫn luyện bằng cách tự so sánh giọng. Premium không có quảng cáo.

Chính sách quyền riêng tư `site/privacy/index.html`: bỏ câu "không hiển thị quảng cáo", thêm mục:

> **Quảng cáo.** Khi bạn tự chọn xem quảng cáo để đổi lượt chấm, quảng cáo do Google AdMob cung cấp. Google có thể thu thập mã nhận dạng thiết bị và dữ liệu sử dụng để hiển thị và đo lường quảng cáo, theo [chính sách của Google](https://policies.google.com/technologies/ads). Trên iOS, quảng cáo chỉ được cá nhân hoá nếu bạn cho phép theo dõi. 4UME chỉ gửi cho Google mã tài khoản ẩn danh để xác nhận bạn đã xem xong, không gửi email, tên hay nội dung học.

Thêm nữa: tắt nhãn *Sắp có* của dòng "Không quảng cáo" trong admin *Quyền lợi Premium*, và thêm mục quảng cáo trong màn *Giới thiệu & bản quyền*.

## Banner (chưa làm)

Ý tưởng cũ: một banner nhỏ cuối Trang chủ cho tài khoản miễn phí. Tạm gác lại vì quảng cáo đổi lượt tự nguyện ít làm phiền hơn; doanh thu banner ở Việt Nam cũng thấp (khoảng 0,1–0,5 USD / 1.000 lượt hiển thị).
