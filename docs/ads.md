# Quảng cáo

Hai loại quảng cáo, chỉ cho tài khoản miễn phí, mục tiêu là có thêm doanh thu trả chi phí Azure và VPS mà không làm phiền người học:

1. **Banner nhỏ** cuối Trang chủ (xem mục cuối).
2. **Quảng cáo đổi lượt chấm**: người học **tự chọn** xem một quảng cáo có thưởng (rewarded ad) để được chấm phát âm thêm **1 lượt**.

## Quảng cáo đổi lượt chấm: nguyên tắc

- **Tự nguyện**: không có quảng cáo tự bật. Có hai chỗ để xem, người học phải tự bấm:
  - **Hồ sơ → Thêm lượt kiểm tra** (dưới dòng gói): màn riêng để tích lượt trước khi ôn. Hiện số lượt còn hôm nay, số quảng cáo đã xem (ví dụ 3/10), nút *Xem quảng cáo +1 lượt*; xem đủ thì nút đổi thành *Đã xem đủ hôm nay*.
  - Trong câu **Đọc to từ này** khi đã hết lượt: nút trong khung *Chấm chi tiết từng âm*.
- Dòng và màn trên Hồ sơ **ẩn hẳn** với Premium, khi admin tắt quảng cáo, hoặc khi dịch vụ chấm tạm dừng.
- **Lượt từ quảng cáo chỉ dùng trong ngày** (theo giờ máy người học), qua ngày mới không còn.
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
  - Trạng thái `GET /api/pronunciation/status` có thêm `adsWatchedToday`, `adsDailyLimit` (0 = không mời xem quảng cáo: Premium, tắt quảng cáo, hoặc dịch vụ chấm tạm dừng), `adsLeftToday`.
- Admin → Cài đặt → Kiểm tra giọng đọc: công tắc **Cho xem quảng cáo đổi lượt chấm** (mặc định **tắt**), **Quảng cáo tối đa mỗi ngày**, số quảng cáo đã xem trong tháng.
- App: màn `AdRewardsScreen.tsx` (mở từ `components/profile/AdRewardsRow.tsx` trên Hồ sơ), nút trong `SpeakExercise.tsx`; cả hai gọi qua `mobile/src/ads/rewarded.ts`.

### SDK AdMob trong app (22/10, nhánh `feature/admob`)

- Gói `react-native-google-mobile-ads` (v17) + `expo-tracking-transparency`, cấu hình plugin trong `mobile/app.json`: App ID iOS / Android (**đang là ID thử nghiệm của Google**, thay bằng ID thật khi có tài khoản), `delayAppMeasurementInit`, SKAdNetwork của Google, câu xin phép theo dõi (ATT) tiếng Việt. Android tự thêm quyền `AD_ID`.
- `mobile/src/ads/sdk.ts`: chỉ nạp SDK khi có module native (Expo Go không có, app vẫn chạy, dùng endpoint giả lập như trước). `initAds()` chạy **một lần, chỉ khi sắp hiện quảng cáo** (banner đang bật hoặc người học bấm xem): hộp thoại đồng ý **UMP** của Google (chỉ hiện ở nơi luật yêu cầu, như EU/UK) → hộp thoại **ATT** trên iOS → mức nội dung **G** → khởi tạo SDK. Người không bao giờ gặp quảng cáo thì không bị hỏi gì.
- Ad unit lấy từ biến `EXPO_PUBLIC_ADMOB_REWARDED_IOS/ANDROID`, `EXPO_PUBLIC_ADMOB_BANNER_IOS/ANDROID` trong `mobile/eas.json` (đang để trống). Bản dev hoặc thiếu biến thì dùng ad unit thử nghiệm của Google.
- `rewarded.ts`: tải `RewardedAd` với `serverSideVerificationOptions: { userId, customData: localDate() }`, hiện ngay khi tải xong. Đóng trước khi xem hết thì báo "Bạn cần xem hết quảng cáo…". Xem hết thì hỏi lại `/api/pronunciation/status` mỗi giây, tối đa 8 giây, tới khi `adsWatchedToday` tăng; quá thời gian thì báo "Lượt này chưa được tính". Ad unit thử nghiệm không gọi máy chủ, nên bản dev tự gọi `dev-reward` sau khi xem.
- Quảng cáo đổi lượt chỉ tính khi máy chủ nhận xác nhận có chữ ký: với ad unit thử nghiệm trên bản phát hành, xem xong vẫn **không** được cộng lượt. Vì vậy chỉ bật công tắc trong admin sau khi đã điền ad unit thật.

## Việc làm tay

Danh sách đầy đủ ở [todo.md](todo.md#admob--việc-làm-tay): vào AdMob (tài khoản dùng chung với AdSense cho YouTube, `pub-3892770660039931`), thêm 2 app, tạo 4 ad unit (bật **Server-side verification** cho 2 rewarded, URL `https://api.4ume.io.vn/api/ads/admob-reward`), thông báo đồng ý GDPR, chặn nhóm quảng cáo không hợp (hẹn hò, cờ bạc, rượu…), `app-ads.txt`, build EAS, thử bằng quảng cáo thử nghiệm rồi mới bật công tắc.

## Câu chữ đã sửa (22/10)

- Trang chủ `site/index.html` (*Lời hứa về quảng cáo*): banner nhỏ cuối Trang chủ cho tài khoản miễn phí, quảng cáo đổi lượt tự chọn, không quảng cáo tự bật toàn màn hình, Premium không có quảng cáo.
- Chính sách quyền riêng tư `site/privacy/index.html`: bỏ câu "không hiển thị quảng cáo", thêm mục **Quảng cáo** (Google AdMob, mã quảng cáo, ATT, UMP, 4UME chỉ gửi mã tài khoản + ngày), ngày hiệu lực 22/10/2026.
- `site/app-ads.txt`: `google.com, pub-3892770660039931, DIRECT, f08c47fec0942fa0`.
- Nội dung mặc định *Giới thiệu & bản quyền* có thêm mục *Quảng cáo — Google AdMob* (nếu admin đã sửa màn này thì thêm tay).
- Còn lại trên admin: tắt nhãn *Sắp có* của dòng "Không quảng cáo" trong *Quyền lợi Premium*.

## Banner nhỏ

- Chỉ **một banner** trên Trang chủ; **Premium không thấy**. Không quảng cáo xen giữa bài học, ôn tập, bài nghe, chép chính tả.
- **Banner không bị đẩy xuống**: ghim cố định ở đáy màn Trang chủ, ngay trên thanh tab, **nằm ngoài vùng cuộn**. Các thẻ thêm vào Trang chủ (tổng kết tuần, kiểm tra trình độ, ôn tập…) chỉ làm phần nội dung phía trên dài ra và cuộn được, banner luôn nhìn thấy. Phần cuộn chừa khoảng trống dưới cùng bằng chiều cao banner để thẻ cuối không bị che.
- Dùng *anchored adaptive banner* (chiều cao cố định theo bề rộng máy, khoảng 50–60 điểm) để bố cục không nhảy khi quảng cáo tải xong; chưa có quảng cáo thì không chừa ô trống.
- Chừa khoảng cách với thanh tab và ghi chữ "Quảng cáo" (chính sách AdMob cấm đặt sát nút điều hướng).
- **Đã làm** (22/10): `mobile/src/components/ads/HomeBanner.tsx` hiện `BannerAd` kiểu `ANCHORED_ADAPTIVE_BANNER`, chỉ chừa chỗ và hiện nhãn "Quảng cáo" khi quảng cáo đã tải xong. Hiện khi `adsBanner` trong `GET /api/me` là `true`: công tắc admin **Banner quảng cáo ở Trang chủ** (*Cài đặt → Kiểm tra giọng đọc*, lưu trong `PronunciationConfig.HomeBannerEnabled`, mặc định **tắt**) và người học không phải Premium. Expo Go (bản dev) vẫn hiện ô nét đứt giả lập khi công tắc bật.
- Cần một **Banner ad unit** cho mỗi nền tảng (`EXPO_PUBLIC_ADMOB_BANNER_*`).
- Doanh thu banner ở Việt Nam thấp (khoảng 0,1–0,5 USD / 1.000 lượt hiển thị), nên quảng cáo đổi lượt mới là nguồn chính.
