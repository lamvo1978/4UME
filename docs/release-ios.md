# Phát hành iOS (TestFlight → App Store)

Checklist thực hiện sau khi gộp AdMob, celebration và **Premium / đóng băng / mở rộng đàm thoại (core)** trên `main` (cập nhật 28/10/2026).

**EAS Build vs EAS Update (OTA), hotfix sau khi lên store, quota:** xem [mobile-eas-update.md](mobile-eas-update.md).

## Tiến độ golive iOS (cập nhật 28/10/2026)

| Bước | Việc | Trạng thái |
|------|------|------------|
| 1 | Deploy API trên VPS (migrations + Premium core) | ⏳ Sau merge PR: `git pull` + `docker compose up -d --build api` |
| 2 | Build + TestFlight production | ✅ **1.0.0 (21)** (AdMob + celebration); ⏳ **build 22+** sau merge PR này |
| 3 | TestFlight: admin bật banner + rewarded; SSV, celebration | ✅ |
| 4 | Admin trước nộp: Premium, tắt bảng giá, AdMob copy | ✅ |
| 5 | AdMob console: SSV (iOS + Android Rewarded), UMP EU + US | ✅ |
| 6 | Connect: Promotional Text, Description, Age Rating (*Advertising* Yes), App Privacy (+ AdMob), Review Notes, demo, *Manually release* | ✅ (27/10) |
| 7 | Connect: phiên bản 1.0 **gắn build mới nhất (22+)** + screenshot/mô tả | ⏳ **Làm sát golive** |
| 8 | *Add for Review* → *Submit* | ⏳ Sau bước 7 |
| 9 | AdMob → **Link to App Store** (iOS) | ⏳ Sau app **live** |

**Còn lại trước khi public:** bước **7 → 8**, rồi **9** sau khi release.

## Đã kiểm tra trong repo

| Việc | Trạng thái |
|------|------------|
| `npx tsc --noEmit` trong `mobile/` | OK |
| App ID + ad unit thật | `mobile/app.json`, `mobile/eas.json` |
| `app-ads.txt` trên web | `https://4ume.io.vn/app-ads.txt` |
| API AdMob SSV | `GET https://api.4ume.io.vn/api/ads/admob-reward` (403 khi không có chữ ký — endpoint sống) |

## 1. Deploy API (nếu chưa pull bản AdMob trên VPS)

```bash
cd /opt/4ume && git pull && cd deploy/vps && docker compose pull && docker compose up -d
```

## 2. Build iOS production (EAS)

**Cloud** (tốn quota Free plan):

```bash
cd ~/Projects/4UME/mobile
npx eas-cli@latest login    # nếu chưa đăng nhập
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production   # hoặc chọn build trên App Store Connect
```

**Local trên Mac** (hết quota cloud / quen build máy): xem [mobile-eas-update.md — Build iOS trên Mac (`--local`)](mobile-eas-update.md#build-ios-trên-mac-local).

Script gói sẵn (cất `.env.local`, `tsc`, `--local`):

```bash
cd ~/Projects/4UME/mobile
./scripts/eas-local-ios-production.sh
```

Build number tự tăng (`autoIncrement` trong `eas.json`). Không cần đổi `version` trong `app.json` nếu vẫn là 1.0.0 công khai đầu tiên.

**Sau merge (VPS):** API cần migrate — `cd /opt/4ume/deploy/vps && docker compose up -d --build api` (hoặc pull image CI nếu bạn dùng pipeline).

## 3. TestFlight (5–7 ngày hoặc ít nhất vài ngày)

Thử trên máy thật, tài khoản **miễn phí** (không Premium):

1. **Admin** → *Cài đặt* → *Kiểm tra giọng đọc*: bật **Banner quảng cáo ở Trang chủ** và **Cho xem quảng cáo đổi lượt chấm** (mặc định tắt để an toàn trước khi thử).
2. Trang chủ: banner có nhãn "Quảng cáo", không che nút học.
3. Hết lượt chấm phát âm → *Xem quảng cáo* hoặc *Hồ sơ → Thêm lượt kiểm tra* → xem hết quảng cáo → lượt tăng (SSV).
4. Lần đầu xem quảng cáo: UMP (nếu có) + ATT — chọn Có/Không đều phải vẫn xem được quảng cáo.
5. Xong bài / chuỗi ngày / quà luyện câu: video celebration phát, tắt *Giảm chuyển động* trong Cài đặt iOS để so sánh.

**Admin trước khi nộp App Store**

- *Quyền lợi Premium*: ẩn hoặc bỏ nhãn **Sắp có** ở các dòng chưa làm; dòng **Không quảng cáo** không còn "Sắp có" (Premium thật sự không có ads).
- Tắt **Bảng giá** (chưa IAP).
- *Giới thiệu & bản quyền*: có mục Google AdMob (nếu đã sửa tay trên admin thì thêm nội dung theo app).

Nội dung TestFlight gợi ý: mục **What to Test** trong [store-listing.md](store-listing.md) (bản gộp AdMob + celebration).

## 4. App Store Connect (trước *Submit for Review*)

Làm theo [store-listing.md](store-listing.md):

- Cập nhật **Promotional Text** và **Description** (đã ghi rõ quảng cáo cho tài khoản miễn phí).
- **Age Rating**: *Advertising* = **Yes**.
- **App Privacy**: thêm mục AdMob (bảng *[AdMob]*).
- **App Review Notes**: dán khối tiếng Anh (AdMob + AI + demo).
- Tài khoản demo `lamvo1978+review@gmail.com` + Premium, có tiến độ học.
- *Version Release*: **Manually release**.

## 5. AdMob (làm tay trên console)

Xem [todo.md](todo.md#admob--việc-làm-tay). Sau khi app **live** trên App Store: *Apps* → **Link to app store**.

## 6. Android

iOS có thể lên trước. Google Play vẫn cần thử nghiệm kín 12 người × 14 ngày — [store-listing.md](store-listing.md#thử-nghiệm-kín-closed-testing).

Build `.aab` trên máy (hết quota cloud): [mobile-eas-update.md — Android (`--local`)](mobile-eas-update.md#android-mac-hoặc-linux).
