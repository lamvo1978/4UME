# Việc tiếp theo (cập nhật 10/10/2026)

Thứ tự gợi ý, việc trên làm trước. Việc vận hành VPS (mật khẩu tạm, chứng chỉ PetHubPro, hộp thư Zoho) xem [todo-deploy.md](todo-deploy.md).

## 1. Trang web bắt buộc để lên store

- [ ] **Chính sách quyền riêng tư** `https://4ume.io.vn/privacy`: thu thập gì (email, tên hiển thị, tiến độ học, mã thiết bị nhận thông báo, ghi âm giọng gửi Azure để chấm, không lưu, nội dung góp ý + ảnh chụp màn hình tự đính kèm + phiên bản app / đời máy), để làm gì, lưu ở đâu, cách xoá.
- [ ] **Trang xin xoá tài khoản** `https://4ume.io.vn/delete-account` (Google bắt buộc có link web, ngoài nút xoá trong app).
- Chi tiết: [app-store.md](app-store.md).

## 2. Gợi ý Premium khi hết lượt chấm

- [ ] Khi hết lượt chấm chi tiết: nhắc nhẹ, mở màn *Premium* (chỉ giới thiệu, chưa bán).
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

## 5. Nội dung

- [ ] Thêm bài nghe (có prompt mẫu: [listening-prompt.md](listening-prompt.md)), bài ngữ pháp.
- [ ] Duyệt ảnh tự gán cho từ vựng.

## Ý tưởng để sau

- [ ] **Hoạt hình chú ngựa kiểu Duolingo** (Lottie): thuê vẽ hoặc dùng mẫu LottieFiles đổi màu 4UME; cần hình ngựa vector tách bộ phận (thân, chân, đầu, bờm, đuôi). Có file `.json` thì gắn vào màn *Xong bài ôn* bằng `lottie-react-native` (chạy được trong Expo Go).
