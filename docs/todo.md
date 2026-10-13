# Việc tiếp theo (cập nhật 13/10/2026)

Thứ tự gợi ý, việc trên làm trước. Việc vận hành VPS (mật khẩu tạm, chứng chỉ PetHubPro, hộp thư Zoho) xem [todo-deploy.md](todo-deploy.md).

## 1. Trang web bắt buộc để lên store

- [x] **Chính sách quyền riêng tư** `https://4ume.io.vn/privacy/`, **xoá tài khoản trên web** `https://4ume.io.vn/delete-account/`, **trang hỗ trợ** `https://4ume.io.vn/` (nguồn `site/`).
- [x] Bật lên VPS (11/10): DNS `@` và `www`, `4ume.conf` — xem [deploy-vps.md](deploy-vps.md#trang-web-4umeiovn).
- Chi tiết: [app-store.md](app-store.md); nội dung trang và khi nào phải sửa: [site.md](site.md).

## 2. Gợi ý Premium khi hết lượt chấm

- [x] Khi hết lượt chấm chi tiết: nhắc nhẹ, mở màn *Premium* (chỉ giới thiệu, chưa bán). Mỗi lần chấm (kể cả đọc lại) là một lượt; hết lượt có thể tự chọn xem quảng cáo đổi thêm lượt (12/10, đang tắt chờ AdMob) — xem [pronunciation.md](pronunciation.md), [ads.md](ads.md).
- Không hướng dẫn thanh toán ngoài app (Apple cấm khi chưa có In‑App Purchase).

## 3. Chuẩn bị hồ sơ store

Bản nháp mô tả, từ khoá, App Privacy, Data safety, ghi chú cho người duyệt: [store-listing.md](store-listing.md).

- [x] iOS: bản 4 gửi duyệt TestFlight bên ngoài (nhóm *Friends*, 13/10) → duyệt xong bật **Public Link** gửi bạn bè.
- [ ] **Android** (Google đã xác minh danh tính 13/10):
  1. Firebase: tạo project `4UME` (tắt Analytics), thêm app Android `com.fourume.app`, tải `google-services.json` vào `mobile/`; tạo khoá *service account* FCM V1 rồi `npx eas-cli credentials` → Android → *Push Notifications (FCM V1)* → tải khoá lên. Agent nối `android.googleServicesFile` trong `app.json`.
  2. Play Console: tạo app *4UME - Học tiếng Anh*, điền *Nội dung ứng dụng* + *An toàn dữ liệu* theo [store-listing.md](store-listing.md#google-play-play-console), khai quyền phát nền (*Media playback*).
  3. `npx eas-cli build -p android --profile production` → tải `.aab` lên *Thử nghiệm kín* bằng tay (lần đầu bắt buộc).
  4. Gom **12 người thử Android** (Gmail), giữ đủ **14 ngày** → xin phát hành chính thức.
- [ ] Mô tả ngắn / đầy đủ, từ khoá, danh mục *Giáo dục* (đã có nháp, chờ dán vào store).
- [ ] Ảnh chụp màn hình iPhone 6,9" và 6,5", Android; ảnh nổi bật Google Play 1024×500.
- [ ] Biểu tượng 1024×1024 không trong suốt.
- [ ] **Tài khoản demo** cho người duyệt (có sẵn ít tiến độ học, không phải tài khoản quản trị).
- [ ] Bảng câu hỏi nội dung, *App Privacy* / *Data safety*.
- [ ] Trước bản build nộp App Store: bỏ chữ *Sắp có* / *Sắp mở đăng ký* / "bản cập nhật tới" ở màn Premium (Apple hay từ chối nội dung "sắp ra mắt"), chỉ nói nhận Premium qua mời bạn bè hoặc mã trung tâm. Các bước nộp: [store-listing.md](store-listing.md#các-bước-nộp-trên-app-store-connect).

## 4. Bản build riêng (EAS) — cần tài khoản Apple Developer

- [x] Thông báo đẩy thật từ máy chủ (13/10, iOS từ build 3): tổng kết tuần, gọi quay lại sau 14/30 ngày, báo khi 4UME trả lời góp ý, nút *Gửi thông báo thử* ở trang người dùng; nội dung sửa ở admin *Thông báo* — xem [notifications.md](notifications.md#giai-đoạn-2--thông-báo-đẩy-từ-máy-chủ-đã-làm-ios-trước). Android chờ Firebase (sau khi Google Play xong).
- [x] **Gửi thông báo hàng loạt** (13/10): admin *Gửi thông báo* + công tắc **Tin mới từ 4UME** trong Cài đặt app (từ build sau build 4) — xem [notifications.md](notifications.md#giai-đoạn-3--gửi-thông-báo-hàng-loạt-đã-làm). Còn lại: đếm số lần chạm mở. Tin khuyến mãi cần người dùng đồng ý rõ ràng (Apple Guideline 4.5.4): `NotifyNews` đang mặc định bật, nên chỉ gửi tin về nội dung / tính năng mới.
- [x] **Rà soát Android** (13/10): tạo kênh thông báo trước khi xin quyền (Android 13+ không hiện hộp thoại nếu chưa có kênh), kênh `default` tên "Tin từ 4UME" cho thông báo từ máy chủ; né bàn phím trên Android (giao diện tràn viền). Có từ build Android thứ 2.
- [ ] Nhận dạng giọng của máy (`expo-speech-recognition`) khi hết lượt chấm Azure.
- [ ] Nền cho AdMob và mua Premium trong app (In‑App Purchase / Google Play Billing) — xem [pronunciation.md](pronunciation.md#giai-đoạn-sau).
- [x] **Báo lỗi crash tự động** (Sentry, gói miễn phí, 13/10): app (bản build thật, từ build 4) và API; chỉ gửi mã tài khoản, không email / IP / quay màn hình. Bật bằng biến môi trường: app `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` trên EAS, API `SENTRY_DSN_API` trong `.env` của VPS. Đã thêm vào `privacy/`. Khi khai App Privacy / Data safety: *Crash data* + *User ID*, không dùng để theo dõi. Web admin chưa gắn.

## 5. Nội dung

- [ ] Thêm bài nghe (có prompt mẫu: [listening-prompt.md](listening-prompt.md)), bài ngữ pháp.
- [ ] Duyệt ảnh tự gán cho từ vựng.

## 6. Tính năng mới (thứ tự đã chốt 11/10)

Làm lần lượt từ trên xuống. Mục nào thu thêm dữ liệu hoặc dùng dịch vụ bên ngoài thì sửa trang quyền riêng tư — xem [site.md](site.md#khi-nào-phải-sửa-trang).

1. [x] **Ôn từ hay sai** (11/10) — xem [weak-words.md](weak-words.md). Còn lại: **thống kê âm hay sai** (đang là dòng *Sắp có* trong *Quyền lợi Premium*; điểm từng âm đã bắt đầu được lưu): bản cơ bản miễn phí, thống kê chi tiết có thể là quyền lợi Premium.
2. [x] **Nghe chép chính tả** (11/10) — nút trong từng bài nghe, xem [listening.md](listening.md#người-học-thấy-gì-app).
3. [x] **Tổng kết tuần** (12/10) — màn chi tiết, mở từ Hồ sơ; xem [weekly.md](weekly.md). Thông báo đẩy thứ Hai 08:30 đã có từ build 3 (13/10).
4. [x] **Giới thiệu bạn bè + mã trung tâm đối tác** (12/10) — xem [invites.md](invites.md). Còn lại: mở app thẳng từ link mời (universal link) và báo đẩy "bạn vừa nhận ngày Premium" khi có bản build EAS; nội dung phần IELTS.
   - [ ] **Khai báo giá cho trung tâm** trên admin: mỗi đối tác có bảng giá (tiền / học viên / tháng, áp dụng từ tháng nào), tháng nào lấy giá đang áp dụng tháng đó để đổi giá không làm sai các tháng cũ; thẻ *Thống kê tháng* và file Excel thêm cột **Thành tiền** + tổng tiền. Hiện thống kê mới đếm số tháng tính phí.
5. [ ] **Truyện ngắn từ những từ đã học**: Gemini soạn đoạn văn ngắn theo chủ đề / cấp độ, admin duyệt trước khi đăng (giống quy trình bài nghe), có giọng đọc và tô sáng từ đã học.
6. [ ] **Tiến độ theo cấp độ**: "Bạn đã nắm 62% từ vựng A2" trên Hồ sơ / Trang chủ, có đích để phấn đấu.
7. [ ] **Chế độ tối và chữ to**: theo cài đặt của máy (giao diện tối, cỡ chữ hệ thống); kiểm tra lại các màn không vỡ bố cục khi chữ to.
8. [ ] **Học cùng bạn bè**: kết bạn bằng mã, xem chuỗi ngày học của nhau, nút "nhắc bạn" (không có bảng xếp hạng công khai). Cần thông báo đẩy thật để "nhắc bạn" có ý nghĩa.
9. [ ] **Ảnh chia sẻ chuỗi ngày học** lên Facebook / Zalo (ảnh tạo trong app, có logo + link `4ume.io.vn`).
10. [ ] **Thống kê nội dung trên admin**: từ nhiều người sai nhất, âm hay đọc sai, bài hay bỏ dở, kết hợp các góp ý *Báo lỗi từ này* — biết nên sửa / bổ sung nội dung nào trước.
11. [ ] **Chế độ lớp học**: giáo viên / người hướng dẫn tạo lớp, giao bộ từ, xem tiến độ học viên — cho các lớp học tình nguyện, đúng sứ mệnh miễn phí cho cộng đồng.

## Ý tưởng để sau

- [ ] **Hoạt hình chú ngựa kiểu Duolingo** (Lottie): thuê vẽ hoặc dùng mẫu LottieFiles đổi màu 4UME; cần hình ngựa vector tách bộ phận (thân, chân, đầu, bờm, đuôi). Có file `.json` thì gắn vào màn *Xong bài ôn* bằng `lottie-react-native` (chạy được trong Expo Go).
