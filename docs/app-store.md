# Đưa app lên Google Play và App Store

> Trạng thái (10/10/2026): **chưa bắt đầu**. Dự kiến đăng ký tài khoản nhà phát triển Android + iOS trong vài ngày tới.
> App hiện chỉ chạy thử qua Expo Go (`cd mobile && npx expo start`, file `mobile/.env.local` trỏ `EXPO_PUBLIC_API_URL=https://api.4ume.io.vn`).

## Thông tin app hiện tại

| | |
|---|---|
| Tên | 4UME |
| Mã định danh | `com.fourume.app` (iOS `bundleIdentifier`, Android `package` trong `mobile/app.json`) — **không đổi được sau khi đã đưa lên cửa hàng**. Không dùng dạng `vn.io.4ume…`: phần nào của mã Android cũng không được bắt đầu bằng chữ số. |
| Phiên bản | `1.0.0` (`version` trong `app.json`); số build tự tăng (`appVersionSource: remote`, `autoIncrement` trong `eas.json`) |
| Expo SDK | 57 (React Native 0.86) |
| API | Mọi bản build EAS trỏ `https://api.4ume.io.vn` (`mobile/eas.json` → `build.base.env`) |

Profile build trong `mobile/eas.json`:

| Profile | Dùng cho |
|---|---|
| `preview` | Android **APK** cài thẳng lên máy để thử |
| `production` | Bản phát hành: Android `.aab` cho Google Play, iOS cho TestFlight / App Store |

## Tài khoản cần có

### Google Play Console — 25 USD, trả một lần

- Đăng ký: https://play.google.com/console/signup
- **Tài khoản cá nhân** (tạo sau 11/2023): trước khi phát hành công khai phải chạy **thử nghiệm kín với ít nhất 12 người dùng, liên tục 14 ngày**. Chuẩn bị sẵn danh sách 12 người dùng Android (Gmail của họ).
- **Tài khoản tổ chức**: không bị yêu cầu 12 người / 14 ngày, nhưng cần mã **D-U-N-S** (miễn phí, xin vài ngày đến vài tuần).
- Phải xác minh danh tính (CCCD / hộ chiếu) và số điện thoại.

### Apple Developer Program — 99 USD / năm

- Đăng ký: https://developer.apple.com/programs (dùng Apple ID có bật xác thực 2 lớp).
- Cá nhân: duyệt 1–2 ngày, tên người bán hiện là tên cá nhân. Tổ chức: cần D-U-N-S, lâu hơn.
- Có tài khoản rồi mới build được bản cài lên iPhone (TestFlight) và nộp App Store.

### Expo (EAS) — miễn phí

- Tài khoản expo.dev đã dùng để đăng nhập Expo Go. Gói miễn phí đủ build (xếp hàng chờ lâu hơn gói trả phí).

## Việc cần chuẩn bị (cả hai cửa hàng)

- [ ] **Chính sách quyền riêng tư** — trang công khai, ví dụ `https://4ume.io.vn/privacy`: thu thập gì (email, tên hiển thị, tiến độ học, mã thiết bị nhận thông báo), để làm gì, lưu ở đâu (VPS tại Việt Nam), cách xoá.
- [ ] **Trang xin xoá tài khoản** trên web, ví dụ `https://4ume.io.vn/delete-account` (Google bắt buộc có link web, ngoài nút xoá trong app).
- [x] **Xoá tài khoản ngay trong app** (Apple bắt buộc): đã có ở *Hồ sơ* (`POST /api/me/delete`, phải nhập mật khẩu).
- [ ] **Tài khoản demo** cho người duyệt (email + mật khẩu, có sẵn ít tiến độ học). Không dùng tài khoản quản trị.
- [ ] Biểu tượng 1024×1024 (không trong suốt cho iOS), ảnh nền thông báo Android.
- [ ] **Ảnh chụp màn hình**: iPhone 6,9" (1320×2868) và 6,5"; Android điện thoại (tối thiểu 2 ảnh); Google Play cần thêm ảnh nổi bật 1024×500.
- [ ] Mô tả ngắn (Google ≤ 80 ký tự), mô tả đầy đủ, từ khoá (iOS), danh mục *Giáo dục*.
- [ ] Bảng câu hỏi nội dung: độ tuổi, quảng cáo (không), mua trong app (không), *Data safety* (Google) / *App Privacy* (Apple) khai đúng như chính sách quyền riêng tư. Có ghi âm giọng để chấm phát âm (gửi Azure, không lưu). Khi bật AdMob / Premium trả phí thì khai lại (xem [pronunciation.md](pronunciation.md#giai-đoạn-sau)).
- [x] **Giới thiệu & bản quyền** trong app (*Hồ sơ*): trích dẫn CEFR-J bắt buộc, nguồn ảnh Pixabay / Pexels, giọng đọc AI Azure, Gemini. Nội dung sửa / ẩn hiện trên admin web, trang *Giới thiệu app*; riêng trích dẫn CEFR-J cố định trong app, admin không sửa được.
- [ ] Email hỗ trợ (nên là `hotro@4ume.io.vn` — cần làm Zoho trước, xem [email.md](email.md#hộp-thư-thật-zoho-mail-chưa-làm)).

## Các bước build và nộp

```bash
cd ~/Projects/4UME/mobile
npx eas-cli@latest login
npx eas-cli@latest init          # lần đầu: tạo dự án EAS, thêm projectId vào app.json → commit app.json
```

### Android

```bash
npx eas-cli@latest build -p android --profile preview      # APK để tự thử
npx eas-cli@latest build -p android --profile production   # .aab cho Google Play
npx eas-cli@latest submit -p android                       # hoặc tải .aab lên Play Console bằng tay
```

- Lần đầu chọn **Generate a new Android Keystore** → Expo giữ hộ (các bản sau dùng lại; mất keystore là không cập nhật app được).
- Play Console: tạo app → *Testing → Closed testing* → thêm 12 người thử → chạy đủ 14 ngày → xin *Production access*.
- Lần nộp đầu qua `eas submit` cần **service account key** của Google Play (làm theo hướng dẫn trong lệnh), hoặc lần đầu tải `.aab` lên bằng tay.

### iOS

```bash
npx eas-cli@latest build -p ios --profile production   # EAS tự tạo chứng chỉ + provisioning profile
npx eas-cli@latest submit -p ios                       # đưa lên App Store Connect / TestFlight
```

- Cài **TestFlight** trên iPhone để thử bản build.
- App Store Connect: điền thông tin, ảnh, chọn bản build → *Submit for Review* (thường 1–3 ngày).

## Sau khi có bản build thật

- **Thông báo đẩy** (giai đoạn 2 của [notifications.md](notifications.md)): cần bản build thật; iOS cần khoá APNs từ tài khoản Apple Developer.
- Mỗi lần sửa app: tăng `version` trong `app.json` nếu là bản mới cho người dùng, rồi build + submit lại. Sửa server **không** cần build lại app.
- Expo Go vẫn dùng được để thử nhanh khi phát triển.
