# Việc tiếp theo (cập nhật 11/10/2026)

Thứ tự gợi ý, việc trên làm trước. Việc vận hành VPS (mật khẩu tạm, chứng chỉ PetHubPro, hộp thư Zoho) xem [todo-deploy.md](todo-deploy.md).

## 1. Trang web bắt buộc để lên store

- [x] **Chính sách quyền riêng tư** `https://4ume.io.vn/privacy/`, **xoá tài khoản trên web** `https://4ume.io.vn/delete-account/`, **trang hỗ trợ** `https://4ume.io.vn/` (nguồn `site/`).
- [x] Bật lên VPS (11/10): DNS `@` và `www`, `4ume.conf` — xem [deploy-vps.md](deploy-vps.md#trang-web-4umeiovn).
- Chi tiết: [app-store.md](app-store.md); nội dung trang và khi nào phải sửa: [site.md](site.md).

## 2. Gợi ý Premium khi hết lượt chấm

- [x] Khi hết lượt chấm chi tiết: nhắc nhẹ, mở màn *Premium* (chỉ giới thiệu, chưa bán). Mỗi lần chấm (kể cả đọc lại) là một lượt; hết lượt có thể tự chọn xem quảng cáo đổi thêm lượt (12/10, đang tắt chờ AdMob) — xem [pronunciation.md](pronunciation.md), [ads.md](ads.md).
- Không hướng dẫn thanh toán ngoài app (Apple cấm khi chưa có In‑App Purchase).

## 3. Chuẩn bị hồ sơ store

- [ ] Mô tả ngắn / đầy đủ, từ khoá, danh mục *Giáo dục*.
- [ ] Ảnh chụp màn hình iPhone 6,9" và 6,5", Android; ảnh nổi bật Google Play 1024×500.
- [ ] Biểu tượng 1024×1024 không trong suốt.
- [ ] **Tài khoản demo** cho người duyệt (có sẵn ít tiến độ học, không phải tài khoản quản trị).
- [ ] Bảng câu hỏi nội dung, *App Privacy* / *Data safety*.

## 4. Bản build riêng (EAS) — cần tài khoản Apple Developer

- [ ] Thông báo đẩy thật (Expo Go không hỗ trợ đầy đủ), gồm cả báo khi 4UME trả lời góp ý ([feedback.md](feedback.md)).
- [ ] Nhận dạng giọng của máy (`expo-speech-recognition`) khi hết lượt chấm Azure.
- [ ] Nền cho AdMob và mua Premium trong app (In‑App Purchase / Google Play Billing) — xem [pronunciation.md](pronunciation.md#giai-đoạn-sau).
- [ ] **Báo lỗi crash tự động** (Sentry, gói miễn phí): app văng trên máy ai thì biết ngay lỗi ở đâu, kèm phiên bản app / loại máy. Làm ngay ở bản build EAS đầu tiên, trước khi mời bạn bè thử nhiều vòng. Có thể gắn luôn cho API và web admin. Thêm Sentry vào mục bên thứ ba trong `privacy/`, khai *Crash data* trong App Privacy / Data safety.

## 5. Nội dung

- [ ] Thêm bài nghe (có prompt mẫu: [listening-prompt.md](listening-prompt.md)), bài ngữ pháp.
- [ ] Duyệt ảnh tự gán cho từ vựng.

## 6. Tính năng mới (thứ tự đã chốt 11/10)

Làm lần lượt từ trên xuống. Mục nào thu thêm dữ liệu hoặc dùng dịch vụ bên ngoài thì sửa trang quyền riêng tư — xem [site.md](site.md#khi-nào-phải-sửa-trang).

1. [x] **Ôn từ hay sai** (11/10) — xem [weak-words.md](weak-words.md). Còn lại: **thống kê âm hay sai** (đang là dòng *Sắp có* trong *Quyền lợi Premium*; điểm từng âm đã bắt đầu được lưu): bản cơ bản miễn phí, thống kê chi tiết có thể là quyền lợi Premium.
2. [x] **Nghe chép chính tả** (11/10) — nút trong từng bài nghe, xem [listening.md](listening.md#người-học-thấy-gì-app).
3. [x] **Tổng kết tuần** (12/10) — màn chi tiết, mở từ Hồ sơ; xem [weekly.md](weekly.md). Còn lại: thông báo đẩy thứ Hai 08:30 (bấm mở màn tổng kết) khi có bản build EAS.
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
