# Việc còn lại sau khi triển khai (cập nhật 10/10/2026)

## Nhật ký thay đổi

| Ngày | Commit | Nội dung |
|---|---|---|
| 09/10 | `821f1e2`, `0d1d4ef` | Lên VPS cạnh PetHubPro, SSL wildcard tự gia hạn qua Cloudflare |
| 09/10 | `667b868` | Tài khoản quản trị gốc đổi thành `admin@4ume.io.vn` |
| 09/10 | `30012c8` | Tìm / gắn ảnh Pexels, Pixabay trong admin (trang *Gắn ảnh*, *Tự gán ảnh*, duyệt ảnh tự gán) |
| 09/10 | `3abd602` | App + xem trước admin: ảnh hiện trọn trong khung vuông, nền trắng của ảnh hoà vào thẻ (`mixBlendMode: multiply`), thẻ flashcard có ảnh đưa nội dung lên trên |
| 09/10 | `23b0dcf` | App phát âm được cả khi iPhone gạt sang im lặng (`expo-audio`, `playsInSilentMode`) |
| 09/10 | `700df27` | Admin trên iPhone: thanh nút Lưu nằm trên thanh tab dưới đáy, không bị che |
| 09/10 | `3bead81` | Trang *Hình ảnh*: mỗi ảnh hiện từ đang dùng (tối đa 3, kèm cấp độ, bộ từ), "Chưa dùng" nếu không có |
| 10/10 | `58bd9ab` | Admin tự báo "Đã có bản admin mới" + nút *Tải lại* khi có bản mới (cần cho web admin thêm vào màn hình chính iPhone) |
| 10/10 | `0970172` | Trang *Từ vựng*: lọc **Đã có hình**; tìm kiếm ưu tiên từ khớp chính xác, rồi từ bắt đầu bằng từ khoá |
| 10/10 | `4a33e3e` | Trang *Gắn ảnh*: ô **Tìm từ vựng** để gắn ảnh cho bất kỳ từ nào (kể cả từ đã có ảnh) |
| 10/10 | `ceb1622`, `26861f0` | **Mã xác nhận qua email** khi tạo tài khoản và quên mật khẩu (app + web admin) — xem [email.md](email.md) |

Cập nhật VPS sau mỗi lần push (đợi GitHub Actions *Build images* xong):

```bash
cd /opt/4ume && git pull && cd deploy/vps && docker compose pull && docker compose up -d
```

## Trạng thái hiện tại

- 4UME đang chạy trên VPS `ubuntu22` (`103.53.231.27`), cạnh PetHubPro — xem [deploy-vps.md](deploy-vps.md).
  - Web admin: `https://admin.4ume.io.vn` — đã đăng nhập `admin@4ume.io.vn` thành công.
  - API cho app: `https://api.4ume.io.vn`
  - Mã nguồn + `.env`: `/opt/4ume/deploy/vps` · container `fourume-postgres-1`, `fourume-api-1`, `fourume-admin-1`.
- DNS `4ume.io.vn` quản lý trên Cloudflare (mua ở PA Việt Nam, nameserver `tiffany` / `zeus.ns.cloudflare.com`). Bản ghi A `api`, `admin` → IP VPS, **DNS only** (mây xám).
- SSL wildcard `4ume.io.vn` + `*.4ume.io.vn`, **tự gia hạn** qua certbot + plugin Cloudflare (token chỉ có quyền DNS của `4ume.io.vn`, lưu ở `/root/.secrets/cloudflare-4ume.ini`). Hết hạn 07/01/2027, certbot tự gia hạn trước đó; hook `/usr/local/sbin/4ume-cert-hook` chép chứng chỉ sang nginx và reload.
- Dữ liệu trên VPS là dữ liệu **mới** (không chuyển từ máy cá nhân), đang dùng để thử nghiệm.
- Email: Resend gửi mã từ `noreply@4ume.io.vn` (domain Verified, key trong `.env` trên VPS) — [email.md](email.md).
- `.env` trên VPS hiện có: `POSTGRES_PASSWORD`, `JWT_KEY`, `ADMIN_INITIAL_PASSWORD` (nên xoá), `PIXABAY_API_KEY`, `RESEND_API_KEY`. Pexels đang **tạm ngừng cấp key mới**, nên chỉ dùng Pixabay; có key Pexels sau thì thêm `PEXELS_API_KEY`.

## Ghi chú khi dùng

- **Web admin "Thêm vào màn hình chính" trên iPhone**: iOS mở lại trang cũ nên trước đây phải xoá cache mới thấy bản mới. Từ `58bd9ab`, admin tự kiểm tra bản mới (khi mở lại, khi quay lại tab, mỗi 5 phút) và hiện thanh *Đã có bản admin mới → Tải lại*. Bản cũ đã cài trước đó cần xoá cache **một lần** (hoặc xoá biểu tượng và thêm lại) để có tính năng này.
- **Expo Go trên iPhone**: Mac và app Expo Go phải đăng nhập cùng tài khoản Expo (`npx expo login`). Chạy `cd mobile && npx expo start --go -c`, quét QR bằng Camera.
- **Máy dev**: `dotnet build` có lúc treo — build API bằng `docker compose up -d --build api` (lỗi `mcr.microsoft.com … EOF` là lỗi mạng tạm thời, chạy lại).

## Nên làm sớm

- [x] Đổi mật khẩu tài khoản quản trị gốc. Email gốc đổi từ `admin@4ume.com` sang `admin@4ume.io.vn` (migration `RenameOwnerEmail` tự đổi khi API cập nhật; mật khẩu giữ nguyên).
- [ ] Xoá mật khẩu tạm trong `.env` trên VPS:
  ```bash
  cd /opt/4ume/deploy/vps
  sed -i 's/^ADMIN_INITIAL_PASSWORD=.*/ADMIN_INITIAL_PASSWORD=/' .env
  ```
- [ ] **Chứng chỉ PetHubPro hết hạn 19/11/2026** và đang là `manual` (không tự gia hạn). Gia hạn tay trước hạn, hoặc chuyển DNS `pethubpro.io.vn` sang Cloudflare và làm giống 4UME để tự gia hạn.
- [x] Reboot VPS lên kernel `5.15.0-198` (09/10/2026) — mọi container PetHubPro + 4UME tự chạy lại. Lần sau khi `apt` hỏi *Which services should be restarted?* thì chọn **none** (tránh restart Docker giữa giờ), reboot vào giờ ít người dùng.

- [ ] **Hộp thư Zoho** `hotro@4ume.io.vn` (nhận thư, email hỗ trợ cho cửa hàng ứng dụng, đặt lại mật khẩu cho `admin@4ume.io.vn`) — [email.md](email.md#hộp-thư-thật-zoho-mail-chưa-làm).

## Ảnh Pexels / Pixabay (trang Gắn ảnh) — đã có Pixabay

Đăng ký 2 API key miễn phí (xem [admin-web.md](admin-web.md#4-hình-ảnh)). Pexels hiện báo *New API key issuance is currently paused*, chỉ cần Pixabay là đủ dùng:

- Pexels: https://www.pexels.com/api/ → *Get Started* → đăng nhập → điền mô tả dự án → nhận key.
- Pixabay: đăng ký tài khoản https://pixabay.com → https://pixabay.com/api/docs/ → key hiện ở mục *Parameters* (`key`).

Trên máy dev: tạo `.env` ở thư mục gốc dự án (git bỏ qua) với 2 dòng `PEXELS_API_KEY=…`, `PIXABAY_API_KEY=…`, rồi `docker compose up -d api`.

Trên VPS: thêm 2 dòng đó vào `/opt/4ume/deploy/vps/.env`, rồi `cd /opt/4ume/deploy/vps && docker compose up -d`.

## 1. Sao lưu tự động (khi dừng thử nghiệm, có dữ liệu thật)

Chạy thử một lần:

```bash
cd /opt/4ume && mkdir -p backups && deploy/backup.sh && ls -lh backups/*/
```

Thấy `db.dump` và `media.tar.gz` thì cài lịch chạy 3 giờ sáng mỗi ngày (giữ 14 bản mới nhất):

```bash
(crontab -l 2>/dev/null; echo '0 3 * * * cd /opt/4ume && deploy/backup.sh >> backups/backup.log 2>&1') | crontab -
crontab -l
```

Định kỳ chép `/opt/4ume/backups/` ra ngoài VPS. Khôi phục: `deploy/restore.sh backups/<thời-gian>`.

> Nếu muốn **xoá sạch dữ liệu thử nghiệm** trước khi dùng thật: `cd /opt/4ume/deploy/vps && docker compose down -v && docker compose up -d` (tạo lại database mới; đặt lại `ADMIN_INITIAL_PASSWORD` trong `.env` trước khi chạy để có lại tài khoản `admin@4ume.io.vn`, xong thì xoá đi).

## 2. Build app điện thoại

> Kế hoạch đưa lên Google Play / App Store (tài khoản, yêu cầu 12 người thử 14 ngày của Google, chính sách quyền riêng tư, ảnh chụp…): [app-store.md](app-store.md).

Đã có sẵn [`mobile/eas.json`](../mobile/eas.json): mọi bản build trỏ về `https://api.4ume.io.vn`.

| Profile | Dùng cho |
|---|---|
| `preview` | Android **APK** cài thẳng lên máy để test |
| `production` | Bản phát hành (iOS TestFlight / App Store, Android Google Play) |

### Android (APK — miễn phí)

Trên máy Mac:

```bash
cd ~/Projects/4UME/mobile
npx eas-cli@latest login      # tài khoản expo.dev (miễn phí; chưa rõ đã có chưa — thử lamvo1978@gmail.com)
npx eas-cli@latest init       # lần đầu: chọn Yes để tạo dự án, thêm projectId vào app.json
npx eas-cli@latest build -p android --profile preview
```

- Hỏi *Generate a new Android Keystore?* → **Yes** (Expo giữ hộ; các bản sau dùng lại).
- Build ~10–20 phút trên máy chủ Expo → mở link / quét QR trên điện thoại Android → tải `.apk` → cài (cho phép cài từ nguồn này).
- Commit `app.json` (có `projectId`) sau lần `init` đầu tiên.

### iPhone

- Cần **Apple Developer Program** (99 USD/năm, duyệt 1–2 ngày): https://developer.apple.com/programs
- Có tài khoản rồi:
  ```bash
  npx eas-cli@latest build -p ios --profile production
  npx eas-cli@latest submit -p ios          # đưa lên TestFlight
  ```
  Cài app **TestFlight** trên iPhone để tải bản thử.
- Chưa có tài khoản: chỉ thử được qua **Expo Go** (`EXPO_PUBLIC_API_URL=https://api.4ume.io.vn npx expo start`, Mac phải đang chạy lệnh này).

## Sau đó

- Thông báo đẩy (push) — giai đoạn 2 của [notifications.md](notifications.md), cần build thật (APK / TestFlight) và tài khoản Apple cho iPhone.
- Mỗi lần cập nhật server: push code lên `main` → đợi GitHub Actions *Build images* → trên VPS `cd /opt/4ume && git pull && cd deploy/vps && docker compose pull && docker compose up -d` (chi tiết: [deploy-vps.md](deploy-vps.md#cập-nhật-phiên-bản-mới)).
