# Mobile: EAS Build, TestFlight và EAS Update (OTA)

Tài liệu tham chiếu nhanh cho app **4UME** (`mobile/`, Expo SDK 57). Cập nhật **29/10/2026**.

## Chốt: dùng **EAS Update** hay **build lại**?

**Quy tắc một dòng:** Feature / fix **chỉ JS–TS–UI–asset trong repo** → merge `main` → **`eas update`**. Mọi thứ **đụng native** hoặc **bản store chưa từng có OTA đúng chuẩn** → **`eas build` + submit**.

### Luồng chuẩn (sau khi đã có bản TestFlight “OTA-ready”)

1. **Merge PR lên `main`** (mobile + admin + API nếu có).
2. **Deploy API/admin** trên VPS nếu backend đổi (`docker compose up -d --build api`, build admin static).
3. **Mobile hotfix (mặc định):**

```bash
cd mobile
# Đổi tên tạm .env.local để không nhúng API LAN vào bundle production
mv .env.local .env.local.off 2>/dev/null || true
# BẮT BUỘC: --environment production trên EAS thường KHÔNG có EXPO_PUBLIC_API_URL (chỉ có trong eas.json lúc *build*).
# Thiếu EXPO_PUBLIC_* → OTA trỏ localhost / AdMob Test IDs (test mode, thưởng quảng cáo không cộng lượt). Release code có fallback API + ad units; vẫn nên set rõ:
EXPO_PUBLIC_API_URL=https://api.4ume.io.vn \
EXPO_PUBLIC_ADMOB_REWARDED_IOS=ca-app-pub-3892770660039931/3622306884 \
EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-3892770660039931/1601728336 \
CI=1 npx eas-cli@latest update --branch production --environment production -p ios --message "Mô tả ngắn"
mv .env.local.off .env.local 2>/dev/null || true
```

4. Tester **tắt hẳn app → mở lại** (lần 1 có thể chỉ **tải nền**; **lần mở sau** chạy bundle OTA mới). Wi‑Fi bật. Trong một phiên đang dùng app, **không** reload giữa chừng.

**Không** build `.ipa` mới cho từng hotfix UI/logic nếu bước trên đủ.

### Khi **bắt buộc** `eas build` + TestFlight / Store

| Tình huống | Vì sao OTA không đủ |
|------------|---------------------|
| Lần đầu bật / sửa **`expo-updates`**, channel, `runtimeVersion` trong native | Cấu hình nằm trong **.ipa** |
| Đổi `app.json`: **`checkAutomatically`**, plugin native, quyền, SDK | Prebuild / Info.plist |
| Thêm / gỡ **native module** (AdMob, speech, video, blur, …) | Binary khác → cần runtime mới hoặc build mới |
| Tăng **`expo.version`** với policy `runtimeVersion: appVersion` | OTA cũ không khớp runtime |
| Muốn **chắc chắn** ship feature lớn **không phụ thuộc OTA** (demo golive, deadline) | JS embed trong build — vẫn hợp lệ, nhưng **không thay** cho OTA sau này |

**Build 27 (list từ ôn lại):** feature embed trong `.ipa` lúc `eas build --local` — **đúng** khi chưa tin OTA hoặc chưa merge `main`. Các bản **sau** build OTA-ready: ưu tiên **`eas update`** cho sửa tương tự.

### Cấu hình OTA trong repo (phải có trên `main` trước build production)

| File | Giá trị |
|------|---------|
| `mobile/app.json` → `updates.checkAutomatically` | **`ON_LOAD`** (không dùng `ON_ERROR_RECOVERY` — gần như không bao giờ kéo update khi mở app bình thường) |
| `mobile/App.tsx` | Gọi **`applyOtaOnLaunch()`** — **tải** bundle mới nền sau ~4s; **không** `reloadAsync` giữa phiên (tránh cắt API / banner “mất mạng” giả). Bản OTA **áp dụng lần mở app sau** (cùng `ON_LOAD`) |
| `mobile/eas.json` profile `production` | `channel: production` |
| `runtimeVersion` | `{ "policy": "appVersion" }` → hiện **1.0.0**; OTA và build store **cùng** version app mới nhận update |

### Kiểm tra `.ipa` vừa build (local hoặc cloud)

```bash
unzip -p build-artifacts/build-*.ipa 'Payload/4UME.app/Expo.plist' | plutil -p -
```

Phải thấy: `EXUpdatesEnabled` = true, `expo-channel-name` = **production**, `EXUpdatesRuntimeVersion` = **1.0.0**, `EXUpdatesCheckOnLaunch` = **ALWAYS** (tương đương ON_LOAD).

```bash
unzip -l build-artifacts/build-*.ipa | grep main.jsbundle
```

Thiếu `main.jsbundle` → đừng submit TestFlight.

### Cảnh báo CLI “No compatible builds found” (fingerprint)

Khi `eas update`, Expo có thể báo **không có build khớp fingerprint** (hay gặp với **`eas build --local`**). Update vẫn **publish** lên branch `production`. Máy user vẫn **thường nhận** nếu channel + `runtimeVersion` khớp bản đang cài. Dùng **test OTA** (sửa một dòng copy → chỉ `eas update` → mở app 2 lần) thay vì build lại mỗi lần nghi ngờ.

### Test OTA 5 phút (sau mỗi bản TestFlight OTA-ready)

1. Sửa copy dễ thấy (vd. tiêu đề màn Hồ sơ) trên `main`.
2. Chỉ chạy lệnh `eas update` ở trên — **không** build `.ipa`.
3. Trên iPhone: tắt app → mở → đợi ~10s → tắt → mở lại.
4. Thấy copy đổi → quy trình OTA ổn. Không đổi → kiểm tra channel trong `Expo.plist`, merge `main` đã có `ON_LOAD` + `applyOtaOnLaunch`, rồi mới cân nhắc build mới.

### Lệnh update — lưu ý platform

Mặc định `--platform all` **fail** vì AdMob không export web. Luôn:

```bash
-p ios
# Android sau khi đã có bản Play có expo-updates:
-p android
```

---

## Hai cách ship code mobile

| Cách | Lệnh | Tốn **EAS Build** quota? | Khi nào dùng |
|------|------|---------------------------|--------------|
| **A — EAS Update (OTA)** | `eas update` | **Không** (dùng quota **EAS Update**, thường hào phóng hơn) | Sửa JS/TS, UI, copy, ảnh/video trong bundle, logic không đụng native |
| **B — EAS Build** | `eas build` + `eas submit` | **Có** (mỗi platform ≈ 1 build) | Lần đầu lên TestFlight/App Store, thêm native module, đổi quyền/plugin, nâng SDK |

**Dev local:** `npx expo start` — không tốn quota EAS.

**Hết quota build trên cloud (Free plan):** dùng **`eas build --local`** trên máy — cùng profile `production`, **không** tốn slot build iOS/Android trên server EAS. Xem [Build local (`--local`)](#build-local-local) (iOS + Android).

---

## Trạng thái repo (quan trọng)

- **`expo-updates` đã cấu hình** (`package.json`, `app.json` có `updates.url` + `runtimeVersion`, `eas.json` có `channel` preview/production).
- **iOS:** TestFlight **1.0.0 (27+)** — build local `production` có `ON_LOAD` + JS embed tuỳ commit; hotfix sau merge `main`: **`eas update --branch production --environment production -p ios`**. Xem mục [Chốt](#chốt-dùng-eas-update-hay-build-lại) ở trên.
- **Admin add-on đàm thoại:** cấp user ở chi tiết người dùng; badge **Mở rộng AI** trên app Hồ sơ (OTA hoặc build có code mới nhất).
- **Android:** chưa bản production có OTA trên Play — cần một lần build + upload trước khi OTA Android có hiệu lực.
- Bản store **trước khi bật updates** hoặc **`ON_ERROR_RECOVERY` only** → coi như **không OTA**; cần build mới từ `main` hiện tại.

Chi tiết TestFlight lần đầu: [release-ios.md](release-ios.md).

---

## Sau khi app lên store — hotfix bằng OTA

**Có thể dùng EAS Update** cho hotfix (UI ôn tập, grammar, celebration MP4, v.v.) **mà không** nộp lại App Store từng lần.

Quy trình gợi ý:

1. Merge fix lên `main`.
2. (Tuỳ chọn) `eas update --branch preview` để team thử trước.
3. Ship production:

```bash
cd mobile
npx eas-cli@latest update --branch production --message "Mô tả hotfix ngắn"
```

4. User mở app (hoặc lần mở sau) → tải bundle mới. Theo dõi Sentry / phản hồi tester.

### OTA **được** làm

- JavaScript / TypeScript, React Native UI
- Text tiếng Việt, logic client (API URL vẫn trỏ server hiện tại)
- Asset trong bundle: `assets/celebration/*.mp4`, icon trong project, v.v.

### OTA **không** thay thế build store khi

- Thêm hoặc gỡ **native module** (AdMob, `expo-video`, **`expo-blur`**, speech, …)
- Đổi **quyền** (Info.plist / AndroidManifest), plugin trong `app.json`
- Đổi **bundle id**, signing, push capabilities
- Nâng **Expo SDK** lớn

→ Lúc đó: `eas build` + submit bản store mới (tăng `version` / build number).

### Apple / Google

- OTA kiểu Expo (chỉ JS) phù hợp **sửa lỗi / cải thiện** app học tập; không dùng để đổi hẳn mục đích app.
- Hotfix backend/API: thường **deploy VPS** (xem dưới), app OTA không bắt buộc nếu client không đổi.

---

## Một lần setup `expo-updates` (làm trước build production “có OTA”)

> Phần cài package + `app.json` / `eas.json` đã xong trong repo. **iOS** đã ship bản có OTA. **Android:** còn build + upload Play (bước 4–5).

1. Trong `mobile/`:

```bash
npx expo install expo-updates
```

2. **`app.json`**: thêm `runtimeVersion` (ví dụ gắn với `version`: `"1.0.0"`) và cấu hình `updates.url` theo [Expo EAS Update docs](https://docs.expo.dev/eas-update/introduction/) cho project `7562124a-994f-4661-aba3-3cee57af0c30`.

3. **`eas.json`**: map profile `production` → channel `production` (và tuỳ chọn `preview` → channel `preview`).

4. **Một lần** build store (iOS + Android khi cần):

```bash
cd mobile
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production
```

5. Mọi hotfix sau (chỉ JS/assets): `eas update --branch production`.

**Lưu ý:** Đổi `runtimeVersion` (ví dụ lên app `1.1.0` native) → cần **build mới**; update OTA chỉ áp dụng cho cùng `runtimeVersion`.

---

## Deploy VPS có cần không?

| Thay đổi | VPS |
|----------|-----|
| Chỉ mobile (UI, OTA, MP4) | **Không** |
| API / admin / DB / AdMob SSV backend | **Có** — `git pull` + Docker trên VPS ([deploy-vps.md](deploy-vps.md), [release-ios.md](release-ios.md) mục 1) |

App production trỏ `EXPO_PUBLIC_API_URL=https://api.4ume.io.vn` (`eas.json`).

---

## Build local (`--local`)

Cùng **công thức** với EAS cloud (prebuild, env trong `eas.json`, credential **remote** trên expo.dev), chạy trên máy bạn — **không** tốn quota build cloud. Artifact mặc định copy vào `mobile/build-artifacts/` (gitignore).

**“Local phải giống cloud chứ?”** — về ý tưởng thì đúng: cùng profile `production`, cùng `app.json`, cùng bước bundle + archive. Thực tế vẫn có chỗ **lệch**:

| Yếu tố | Cloud (build 15 ổn) | Local (build 19 lỗi) |
|--------|----------------------|----------------------|
| Môi trường bundle | Máy EAS, **không** có `.env.local` trên repo | Mac của bạn — Expo thường **load `mobile/.env.local`** lúc đóng gói JS (API LAN, v.v.) |
| Xcode / macOS | Image cố định trên server | Xcode + macOS trên Mac (Tahoe 26/27 hay cần patch credential) |
| Mã nguồn | Commit **16bafdc**, chưa `expo-updates` | Commit mới hơn + **`expo-updates`** (native mới) |

So sánh build **15 vs 19** vì vậy **không chỉ** “cloud vs local”, mà còn **hai bản app khác nhau** (có/không OTA native). Local vẫn ship được bản ổn nếu: tắt `.env.local` trước build, kiểm tra `.ipa` có `main.jsbundle`, **tự mở thử trên iPhone** (TestFlight chỉ mình) rồi mới thêm nhóm Friends.

Chung trước mọi build:

```bash
cd ~/Projects/4UME/mobile
npx eas-cli@latest whoami    # lamvo1978
npx tsc --noEmit
mkdir -p build-artifacts
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="$(pwd)/build-artifacts"
```

---

### iOS (Mac)

Dùng khi **hết quota** cloud hoặc quen build Xcode trên máy. Credential: distribution cert + provisioning trên EAS (đã dùng thành công cho 4UME).

#### Chuẩn bị (một lần)

| Công cụ | Kiểm tra | Ghi chú |
|---------|----------|---------|
| Xcode | `xcodebuild -version` | Mở Xcode ≥1 lần, chấp nhận license |
| CocoaPods | `pod --version` | Project dùng CNG — `ios/` sinh lúc build, không commit |
| **fastlane** | `fastlane --version` | Bắt buộc cho `eas build --local` iOS |

Cài fastlane (Mac 4UME — **không** dùng Ruby hệ thống 2.6):

```bash
# Ruby Homebrew + fastlane (brew install fastlane có thể fail khi build openssl trên Intel)
export PATH="/usr/local/opt/ruby/bin:$PATH"
gem install fastlane --user-install
export PATH="$HOME/.gem/ruby/3.4.0/bin:$PATH"
fastlane --version
```

Thêm dòng `export PATH=…` vào `~/.zshrc` để terminal mới vẫn thấy `fastlane`.

Đăng nhập EAS (đã login `lamvo1978` thì bỏ qua):

```bash
cd mobile
npx eas-cli@latest whoami
npx eas-cli@latest login   # nếu cần
```

#### Build production local

**Khuyến nghị** — script tự cất `.env.local`, patch macOS 27, build, kiểm tra `main.jsbundle`, rồi **khôi phục** `.env.local` (simulator/dev như cũ):

```bash
cd ~/Projects/4UME/mobile
bash scripts/eas-local-ios-production.sh
```

Tay (nếu không dùng script):

```bash
# fastlane phải có trong PATH *cùng terminal* với lệnh build (spawn ENOENT nếu thiếu)
export PATH="/usr/local/opt/ruby/bin:$HOME/.gem/ruby/3.4.0/bin:$PATH"
which fastlane   # phải in ra đường dẫn, không rỗng
mv .env.local .env.local.off   # nhớ đổi tên lại sau build

npx eas-cli@latest build -p ios --profile production --local
```

Ghi `export PATH=…` vào `~/.zshrc` (hoặc symlink `fastlane` vào `/usr/local/bin`) để mỗi tab terminal đều thấy fastlane.

- Lần đầu có thể **15–40 phút** (prebuild, `pod install`, archive).
- File `.ipa` nằm trong `mobile/build-artifacts/` (đã gitignore).
- Build number vẫn **autoIncrement** remote (`eas.json` → `appVersionSource: remote`).

**Build lỗi, cần xem log Xcode:**

```bash
export EAS_LOCAL_BUILD_SKIP_CLEANUP=1
# chạy lại lệnh build --local, xem thư mục working dir / logs (EAS in path cuối output)
```

**iOS 27 / Xcode 27 — crash ngay khi mở (`UIScene life cycle is required`, `NoSceneLifecycleAdoption`):**

App build bằng **Xcode 27** trên máy local mà **chưa** bật scene lifecycle sẽ chết trước màn đăng nhập. Bản EAS **cloud** cũ (Xcode 16) có thể vẫn chạy trên iPhone iOS 27 — đừng nhầm là “local = hỏng”.

Repo đã bật `expo-build-properties` → `ios.enableSceneSupport: true` (Expo SDK 57). Sau khi đổi: build lại `.ipa` (OTA **không** sửa được).

**macOS 26/27 — `Distribution certificate ... hasn't been imported successfully` (Prepare credentials):**

Bug EAS trên Tahoe: cert đã import nhưng `security find-identity -v` trả 0 identity. Trước khi build:

```bash
bash mobile/scripts/patch-eas-local-macos27.sh
```

Rồi chạy lại `eas build --local`. (Chạy lại script nếu `npx` tải lại cache EAS.)

#### Đưa lên TestFlight / App Store

Cách 1 — EAS Submit (giống cloud):

```bash
npx eas-cli@latest submit -p ios --profile production --path build-artifacts/build-*.ipa
```

Cách 2 — app **Transporter** (Mac App Store): kéo thả file `.ipa`.

Sau khi build **có `expo-updates`** lên store, hotfix JS: `eas update --channel production --environment production --message "…"`.

**Trước khi submit:** đổi tên tạm `mobile/.env.local` (Expo có thể load file này lúc bundle — API dev LAN không được nhúng vào bản TestFlight). Sau build, kiểm tra `.ipa` có bundle JS:

```bash
unzip -l build-artifacts/build-*.ipa | grep main.jsbundle
```

Phải thấy `main.jsbundle` (hoặc `assets/index.bundle` tùy pipeline). Thiếu file → **đừng** đưa lên TestFlight.

**Crash ngay khi mở (chưa tới đăng nhập):** thường là bản native lỗi, không phải OTA. So sánh với build TestFlight **ổn** gần nhất (ví dụ 1.0.0 **15** cloud vs **19** local + `expo-updates`). Trên App Store Connect → nhóm TestFlight: **gỡ build lỗi**, giữ bản ổn cho tester. Build tiếp theo: ưu tiên **`eas build` cloud** (giống 15) hoặc local sau khi pass bước kiểm tra `.ipa` trên; thử trên máy thật trước khi mở rộng tester.

---

### Android (Mac hoặc Linux)

**Không cần fastlane.** Cần **Android Studio** (SDK + NDK do Gradle/EAS kéo khi build). Chạy trên Mac giống iOS; Windows chỉ qua WSL (Expo không hỗ trợ chính thức).

#### Chuẩn bị (một lần)

| Công cụ | Kiểm tra | Ghi chú |
|---------|----------|---------|
| Android Studio | Mở SDK Manager | Cài **Android SDK**, **SDK Platform** (API mà Expo SDK 57 yêu cầu), **SDK Build-Tools** |
| `JAVA_HOME` | `echo $JAVA_HOME` | Thường JDK bundled trong Android Studio |
| Biến môi trường | `echo $ANDROID_HOME` | Ví dụ macOS: `$HOME/Library/Android/sdk` |

Thêm vào `~/.zshrc` (sửa path nếu SDK khác chỗ):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

Keystore **upload** cho `com.fourume.app`: để EAS quản lý (giống cloud) — lần đầu có thể hỏi tạo/lưu trên [expo.dev](https://expo.dev) → **Credentials** → Android. Local build tải keystore remote khi `credentialsSource: remote` (mặc định).

`google-services.json` phải có trong `mobile/` (Firebase / FCM — xem [todo.md](todo.md)).

#### Build production local (`.aab` — Play Store)

Profile `production` → **Android App Bundle** (mặc định), ký release bằng keystore EAS.

```bash
cd ~/Projects/4UME/mobile
# ANDROID_HOME + PATH như trên
npx tsc --noEmit
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="$(pwd)/build-artifacts"

npx eas-cli@latest build -p android --profile production --local
```

- Artifact: `build-artifacts/build-*.aab`.
- `versionCode` vẫn **autoIncrement** remote (`eas.json`).

#### Build APK nhanh (test máy / tester — profile `preview`)

```bash
npx eas-cli@latest build -p android --profile preview --local
```

→ file `.apk` (internal distribution), không thay cho `.aab` lên Play production.

#### Đưa lên Google Play

**Lần đầu** (4UME): thường upload **bằng tay** Play Console → *Thử nghiệm kín* — xem [todo.md](todo.md) và [store-listing.md](store-listing.md#google-play-play-console).

1. Play Console → app **4UME** → *Phát hành* → *Thử nghiệm* → tạo bản / kênh.
2. *Tạo bản phát hành mới* → upload `build-artifacts/build-*.aab`.

Sau khi cấu hình **Google Play service account** trên EAS, có thể:

```bash
npx eas-cli@latest submit -p android --profile production --path build-artifacts/build-*.aab
```

(hiện `eas.json` mới khai `submit.production.ios`; Android submit thêm khi có service account JSON trên EAS.)

Sau bản **có `expo-updates`** trên Play, OTA Android dùng cùng lệnh `eas update --channel production …` (cùng `runtimeVersion` với bản đang phát hành).

#### Android — lỗi thường gặp

| Triệu chứng | Hướng xử lý |
|-------------|-------------|
| `SDK location not found` | Set `ANDROID_HOME`, cài SDK trong Android Studio |
| Thiếu NDK / Build-Tools | SDK Manager → cài bản Gradle báo thiếu |
| Keystore / credentials | `npx eas-cli@latest credentials -p android` |
| Build chậm lần đầu | Gradle cache + download NDK — bình thường |

Debug giống iOS: `EAS_LOCAL_BUILD_SKIP_CLEANUP=1` rồi build lại, xem log trong working dir.

---

## Lệnh thường dùng

```bash
cd mobile
npx tsc --noEmit                    # trước khi update/build
npx eas-cli@latest build -p ios --profile production --local
npx eas-cli@latest build -p android --profile production --local
npx eas-cli@latest submit -p ios --profile production --path build-artifacts/build-*.ipa
npx eas-cli@latest update --channel production --environment production --message "…"
```

Project EAS: `extra.eas.projectId` trong `app.json`. Submit iOS: `ascAppId` trong `eas.json`.

---

## Liên quan

- [release-ios.md](release-ios.md) — TestFlight, App Store Connect, AdMob thử nghiệm
- [store-listing.md](store-listing.md) — mô tả store, *What to Test*
- [todo.md](todo.md) — việc tay AdMob, Lottie (tùy chọn sau)
