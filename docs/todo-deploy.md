# Việc còn lại sau khi triển khai (tạm dừng 09/10/2026)

## Trạng thái hiện tại

- 4UME đang chạy trên VPS `ubuntu22` (`103.53.231.27`), cạnh PetHubPro — xem [deploy-vps.md](deploy-vps.md).
  - Web admin: `https://admin.4ume.io.vn` — đã đăng nhập `admin@4ume.io.vn` thành công.
  - API cho app: `https://api.4ume.io.vn`
  - Mã nguồn + `.env`: `/opt/4ume/deploy/vps` · container `fourume-postgres-1`, `fourume-api-1`, `fourume-admin-1`.
- DNS `4ume.io.vn` quản lý trên Cloudflare (mua ở PA Việt Nam, nameserver `tiffany` / `zeus.ns.cloudflare.com`). Bản ghi A `api`, `admin` → IP VPS, **DNS only** (mây xám).
- SSL wildcard `4ume.io.vn` + `*.4ume.io.vn`, **tự gia hạn** qua certbot + plugin Cloudflare (token chỉ có quyền DNS của `4ume.io.vn`, lưu ở `/root/.secrets/cloudflare-4ume.ini`). Hết hạn 07/01/2027, certbot tự gia hạn trước đó; hook `/usr/local/sbin/4ume-cert-hook` chép chứng chỉ sang nginx và reload.
- Dữ liệu trên VPS là dữ liệu **mới** (không chuyển từ máy cá nhân), đang dùng để thử nghiệm.

## Nên làm sớm

- [x] Đổi mật khẩu tài khoản quản trị gốc. Email gốc đổi từ `admin@4ume.com` sang `admin@4ume.io.vn` (migration `RenameOwnerEmail` tự đổi khi API cập nhật; mật khẩu giữ nguyên).
- [ ] Xoá mật khẩu tạm trong `.env` trên VPS:
  ```bash
  cd /opt/4ume/deploy/vps
  sed -i 's/^ADMIN_INITIAL_PASSWORD=.*/ADMIN_INITIAL_PASSWORD=/' .env
  ```
- [ ] **Chứng chỉ PetHubPro hết hạn 19/11/2026** và đang là `manual` (không tự gia hạn). Gia hạn tay trước hạn, hoặc chuyển DNS `pethubpro.io.vn` sang Cloudflare và làm giống 4UME để tự gia hạn.
- [ ] Reboot VPS để dùng kernel mới (`5.15.0-198`) — chọn giờ ít người dùng PetHubPro / tablepos. Khi `apt` hỏi *Which services should be restarted?* thì chọn **none** (tránh restart Docker giữa giờ).

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
