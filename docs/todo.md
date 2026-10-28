# Việc tiếp theo (cập nhật 28/10/2026)

Thứ tự gợi ý, việc trên làm trước. Từ 22/10 dừng làm tính năng mới: gắn AdMob, làm nốt việc dở, chờ Google Play duyệt để lên store chính thức, rồi mới sang [Phase 2](#phase-2-sau-khi-lên-store-chính-thức). Việc vận hành VPS (mật khẩu tạm, chứng chỉ PetHubPro, hộp thư Zoho) xem [todo-deploy.md](todo-deploy.md).

## 1. Trang web bắt buộc để lên store

- [x] **app-ads.txt** (22/10) `https://4ume.io.vn/app-ads.txt` cho AdMob (có sau lần deploy tới).
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
- [x] **iOS App Store Connect** (27/10): mô tả, từ khoá, Age Rating (*Advertising*), App Privacy (+ AdMob), Review Notes, demo, *Manually release* — theo [store-listing.md](store-listing.md). Còn: gắn build **21** + *Submit for Review* sát golive ([release-ios.md](release-ios.md#tiến-độ-golive-ios-cập-nhật-27102026)).
- [x] Ảnh iPhone 6,9" (`store/ios/screenshots-6.9/`) — đã upload Connect (27/10). [ ] 6,5" (tuỳ chọn), Android + ảnh nổi bật 1024×500.
- [ ] Biểu tượng 1024×1024 không trong suốt (Play; iOS dùng icon trong build).
- [x] **Tài khoản demo** reviewer + tiến độ học (27/10).
- [x] iOS: bảng câu hỏi nội dung, *App Privacy* (27/10). [ ] Android *Data safety*.
- [ ] Mô tả ngắn / đầy đủ trên **Google Play** (nháp có sẵn).
- [x] Trước bản build nộp App Store: bỏ chữ *Sắp mở đăng ký* / "bản cập nhật tới" ở màn Premium (Apple hay từ chối nội dung "sắp ra mắt"), chỉ nói nhận Premium qua mời bạn bè hoặc mã trung tâm (14/10). Còn lại trên admin: ẩn các quyền lợi đang đánh dấu *Sắp có* (vd *Không quảng cáo*) trước khi nộp. Các bước nộp: [store-listing.md](store-listing.md#các-bước-nộp-trên-app-store-connect).

## 4. Bản build riêng (EAS) — cần tài khoản Apple Developer

- [x] Thông báo đẩy thật từ máy chủ (13/10, iOS từ build 3): tổng kết tuần, gọi quay lại sau 14/30 ngày, báo khi 4UME trả lời góp ý, nút *Gửi thông báo thử* ở trang người dùng; nội dung sửa ở admin *Thông báo* — xem [notifications.md](notifications.md#giai-đoạn-2--thông-báo-đẩy-từ-máy-chủ-đã-làm-ios-trước). Android chờ Firebase (sau khi Google Play xong).
- [x] **Gửi thông báo hàng loạt** (13/10): admin *Gửi thông báo* + công tắc **Tin mới từ 4UME** trong Cài đặt app (từ build sau build 4) — xem [notifications.md](notifications.md#giai-đoạn-3--gửi-thông-báo-hàng-loạt-đã-làm). **Đếm số lần chạm mở** (22/10, nhánh `feature/admob`): app báo lần chạm thông báo từ máy chủ, admin *Gửi thông báo* hiện "X đã mở (Y%)" mỗi đợt và tỉ lệ mở 30 ngày của *Tổng kết tuần* / *Gọi quay lại*; chỉ bản app từ build này mới báo. Tin khuyến mãi cần người dùng đồng ý rõ ràng (Apple Guideline 4.5.4): `NotifyNews` đang mặc định bật, nên chỉ gửi tin về nội dung / tính năng mới.
- [x] **Rà soát Android** (13/10): tạo kênh thông báo trước khi xin quyền (Android 13+ không hiện hộp thoại nếu chưa có kênh), kênh `default` tên "Tin từ 4UME" cho thông báo từ máy chủ; né bàn phím trên Android (giao diện tràn viền). Có từ build Android thứ 2.
- [x] **Kiểm tra nhanh bằng giọng của máy** khi hết lượt chấm Azure (22/10): nút trong khung *Tự so sánh*, máy nghe ra đúng từ hay không (không chấm từng âm). Có công tắc admin *Cài đặt → Kiểm tra giọng đọc*, **mặc định tắt** vì làm người học ít lý do lên Premium.
- [x] **AdMob** (22/10, đã gộp `main`): quảng cáo đổi lượt chấm + banner Trang chủ, UMP và ATT — xem [ads.md](ads.md). App ID và ad unit thật trong `mobile/app.json` / `mobile/eas.json`; bản dev vẫn dùng ad thử nghiệm của Google. Còn bước làm tay trên AdMob console và bật công tắc admin sau TestFlight — mục *AdMob — việc làm tay*.
- [x] **Video celebration** (26/10): màn xong bài / chuỗi / quà luyện câu (`expo-video`, `mobile/assets/celebration/`).
- [ ] **Golive iOS App Store**: TestFlight **1.0.0 (21)** OK; build iOS mới (**22+**, gồm Tìm từ + `expo-blur`, ngữ pháp B2, MCQ nhiều đáp án) sau merge PR 28/10 → gắn build + **Submit for Review** ([release-ios.md](release-ios.md)).
- [x] **Premium Phase 2 (core, chưa IAP)** (28/10): đóng băng chuỗi (admin + app), quota đàm thoại buổi/lượt, gói **mở rộng đàm thoại** (entitlement + admin + màn Premium), migrations `StreakFreezeGrantMonth`, `ConversationAddonQuota` — xem [streak-freeze.md](streak-freeze.md), [premium-iap-roadmap.md](premium-iap-roadmap.md) mục 2–4.
- [ ] **Mua Premium + mở rộng trong app** (IAP) — Phase 2 mục 5–7, [premium-iap-roadmap.md](premium-iap-roadmap.md).

### AdMob — việc làm tay

1. [x] Vào [apps.admob.com](https://apps.admob.com) (27/10). Tài khoản dùng chung với AdSense cho YouTube, mã nhà xuất bản `pub-3892770660039931`.
2. [ ] Kiểm tra *Thanh toán*: thông tin thuế, địa chỉ nhận PIN.
3. [x] Thêm 2 app trên AdMob → **App ID** đã gắn trong `mobile/app.json` (`~5672835286` iOS, `~3489525077` Android).
4. [x] 4 ad unit trong `mobile/eas.json`. [x] Hai *Rewarded* bật **Server-side verification**, URL `https://api.4ume.io.vn/api/ads/admob-reward` (27/10).
5. [x] *Privacy & messaging*: GDPR (Châu Âu) + US states — mỗi loại 1 đang hoạt động (27/10). [ ] *Blocking controls*: chặn hẹn hò, cờ bạc, rượu, đặt mức nội dung G.
6. [x] `https://4ume.io.vn/app-ads.txt` đã lên mạng. [ ] Bấm *Check for updates* trên AdMob.
7. [x] TestFlight **1.0.0 (21)**; admin bật quảng cáo; test máy thật OK (27/10).
8. [x] App Store Connect: mô tả / App Privacy / Age Rating; admin Premium (27/10). Còn *Submit* sau khi gắn build 21.
9. [ ] Sau khi app lên Google Play / App Store: vào AdMob → *Apps* → **Link to app store** cho từng app, để hết chế độ quảng cáo giới hạn.
- [x] **Báo lỗi crash tự động** (Sentry, gói miễn phí, 13/10): app (bản build thật, từ build 4) và API; chỉ gửi mã tài khoản, không email / IP / quay màn hình. Bật bằng biến môi trường: app `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` trên EAS, API `SENTRY_DSN_API` trong `.env` của VPS. Đã thêm vào `privacy/`. Khi khai App Privacy / Data safety: *Crash data* + *User ID*, không dùng để theo dõi. Web admin chưa gắn.

## 5. Nội dung

- [ ] Thêm bài nghe (có prompt mẫu: [listening-prompt.md](listening-prompt.md)).
- [x] **Ngữ pháp B2** (28/10): 10 bài mới (`backend/data/grammar/47`–`56`), tổng **56 bài** A1–B2 — xem [grammar-audit.md](grammar-audit.md).
- [ ] **Ngữ pháp — luyện thêm & kiểm tra đầu vào**: *AI soạn thêm câu* (~30 câu/bài `practice`); kiểm tra đầu vào ~20 câu/cấp (**B2**: file mẫu `backend/data/placement-grammar-b2-import.json` → admin *Nhập JSON*). Tối thiểu 4 câu/cấp đang bật thì app mới hỏi ngữ pháp cấp đó. Xem [grammar-lesson-schema.md](grammar-lesson-schema.md#ngữ-pháp-trong-kiểm-tra-đầu-vào).
- [ ] Duyệt ảnh tự gán cho từ vựng.

## 6. Tính năng Phase 1 (đã chốt 11/10)

**Dừng làm tính năng mới từ 22/10**: chỉ gắn AdMob và làm nốt việc dở, chờ Google Play duyệt để lên store chính thức. Tính năng mới chuyển sang [Phase 2](#phase-2-sau-khi-lên-store-chính-thức). Mục nào thu thêm dữ liệu hoặc dùng dịch vụ bên ngoài thì sửa trang quyền riêng tư — xem [site.md](site.md#khi-nào-phải-sửa-trang).

1. [x] **Ôn từ hay sai** (11/10) — xem [weak-words.md](weak-words.md). Còn lại: **thống kê âm hay sai** (đang là dòng *Sắp có* trong *Quyền lợi Premium*; điểm từng âm đã bắt đầu được lưu): bản cơ bản miễn phí, thống kê chi tiết có thể là quyền lợi Premium.
2. [x] **Nghe chép chính tả** (11/10) — nút trong từng bài nghe, xem [listening.md](listening.md#người-học-thấy-gì-app).
3. [x] **Tổng kết tuần** (12/10) — màn chi tiết, mở từ Hồ sơ; xem [weekly.md](weekly.md). Thông báo đẩy thứ Hai 08:30 đã có từ build 3 (13/10).
4. [x] **Giới thiệu bạn bè + mã trung tâm đối tác** (12/10) — xem [invites.md](invites.md). Còn lại: mở app thẳng từ link mời (universal link) và báo đẩy "bạn vừa nhận ngày Premium" khi có bản build EAS; nội dung phần IELTS.
   - [ ] **Khai báo giá cho trung tâm** trên admin: mỗi đối tác có bảng giá (tiền / học viên / tháng, áp dụng từ tháng nào), tháng nào lấy giá đang áp dụng tháng đó để đổi giá không làm sai các tháng cũ; thẻ *Thống kê tháng* và file Excel thêm cột **Thành tiền** + tổng tiền. Hiện thống kê mới đếm số tháng tính phí.
5. [x] **Đàm thoại với AI** (21/10, nhánh `feature/ai-conversation`) — nhập vai theo tình huống A1–B2 và trò chuyện tự do, nói theo lượt (nhận dạng giọng của máy) hoặc gõ, AI sửa câu và tổng kết; lượt theo ngày cho miễn phí / Premium; admin bật được giọng Azure cho Premium (F0 trước, S0 sau). Xem [conversation.md](conversation.md). Còn lại: đổi lượt bằng quảng cáo, gọi thoại thời gian thực cho Premium, lịch sử buổi đàm thoại.
6. [x] **Luyện viết với AI** (22/10, nhánh `feature/ai-writing`) — viết theo đề A1–B2 hoặc viết tự do, AI chấm điểm (tổng + 4 mặt), tô lỗi kèm giải thích tiếng Việt, viết lại cả đoạn, gợi ý nâng cấp; lượt theo ngày + trần tổng mỗi ngày (để dành phần cho Premium); bản viết lại và toàn bộ lịch sử cho Premium; AI miễn phí: Groq `qwen3.8-27b` trước, Mistral `ministral-14b` dự phòng (gói miễn phí của Mistral không cho dùng model lớn, xem [writing.md](writing.md#chọn-ai-chốt-22102026)); admin có *Chấm thử* để so model. Còn lại: thêm `MISTRAL_API_KEY` vào `.env` VPS (đã tắt cho Mistral dùng dữ liệu để huấn luyện); chấm thử ~20 bài mẫu để chốt model và trần tổng; chốt số lượt Premium cùng lúc với giá trước khi lên store công khai.
## Phase 2 (sau khi lên store chính thức)

Chưa chốt thứ tự; hai ý tưởng mới (22/10) đứng đầu.

1. [ ] **Bộ đề thi**: đề luyện theo cấp độ / dạng bài (từ vựng, ngữ pháp, nghe, đọc), có giờ làm bài, chấm điểm và xem lại câu sai; sau này có thể thêm đề theo chuẩn kỳ thi (IELTS cho học viên trung tâm đối tác).
2. [ ] **Cá nhân hoá lộ trình học**: dựa vào kiểm tra trình độ, mục tiêu và từ / âm / ngữ pháp hay sai để gợi ý mỗi ngày nên học gì tiếp theo.
3. [ ] **Mua Premium trong app** (IAP + mở rộng đàm thoại): giá + lượt + UI đã có; còn store SKU, verify, nút mua — [premium-pricing.md](premium-pricing.md), [premium-iap-roadmap.md](premium-iap-roadmap.md) mục 5–7.
4. [ ] **Truyện ngắn từ những từ đã học**: Gemini soạn đoạn văn ngắn theo chủ đề / cấp độ, admin duyệt trước khi đăng (giống quy trình bài nghe), có giọng đọc và tô sáng từ đã học.
5. [ ] **Tiến độ theo cấp độ**: "Bạn đã nắm 62% từ vựng A2" trên Hồ sơ / Trang chủ, có đích để phấn đấu.
6. [ ] **Chế độ tối và chữ to**: theo cài đặt của máy (giao diện tối, cỡ chữ hệ thống); kiểm tra lại các màn không vỡ bố cục khi chữ to.
7. [ ] **Học cùng bạn bè**: kết bạn bằng mã, xem chuỗi ngày học của nhau, nút "nhắc bạn" (không có bảng xếp hạng công khai).
8. [ ] **Ảnh chia sẻ chuỗi ngày học** lên Facebook / Zalo (ảnh tạo trong app, có logo + link `4ume.io.vn`).
9. [ ] **Thống kê nội dung trên admin**: từ nhiều người sai nhất, âm hay đọc sai, bài hay bỏ dở, kết hợp các góp ý *Báo lỗi từ này* — biết nên sửa / bổ sung nội dung nào trước.
10. [ ] **Chế độ lớp học**: giáo viên / người hướng dẫn tạo lớp, giao bộ từ, xem tiến độ học viên — cho các lớp học tình nguyện, đúng sứ mệnh miễn phí cho cộng đồng.
11. [ ] Việc còn lại của các tính năng Phase 1: thống kê âm hay sai, universal link cho link mời, khai báo giá cho trung tâm, đổi lượt Đàm thoại bằng quảng cáo, lịch sử buổi đàm thoại.

## Ý tưởng để sau

- [ ] **Hoạt hình chú ngựa kiểu Duolingo** (Lottie): thuê vẽ hoặc dùng mẫu LottieFiles đổi màu 4UME; cần hình ngựa vector tách bộ phận (thân, chân, đầu, bờm, đuôi). Có file `.json` thì gắn vào màn *Xong bài ôn* bằng `lottie-react-native` (chạy được trong Expo Go).
