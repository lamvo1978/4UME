# Premium & IAP — lộ trình (Phase 2)

Sau khi app **1.0** lên store (chưa bán trong app). **Giá và lượt đã chốt:** [premium-pricing.md](premium-pricing.md).

Doc này liệt kê **các phần còn lại theo thứ tự nên làm** (doc trước → code sau). Đánh dấu `[ ]` khi bạn/code xong từng mục.

---

## Tổng quan hai sản phẩm

| Sản phẩm | Subscription | Ai mua được |
|----------|--------------|-------------|
| **Premium gốc** | Auto-renewable | Mọi tài khoản đăng nhập |
| **Add-on Đàm thoại** | Auto-renewable (nhóm riêng) | Chỉ khi **đang có Premium gốc** (IAP hoặc admin/partner — quy tắc bên dưới) |

**Phase 2 IAP (sau 1.0 store):** mua Premium + add-on qua Apple/Google; admin bật tay để test; **mời bạn** (+7 ngày) giữ như hiện tại.

**Trung tâm / partner (B2B):** **sau khi app đã lên store và có đối tác** — không chặn ship IAP consumer. Code partner hiện có giữ nguyên; chính sách add-on cho mã trung tâm chốt lúc có partner — xem [invites.md](invites.md).

---

## Thứ tự công việc (sau giá + lượt)

### 1. Giá và lượt — **xong**

[premium-pricing.md](premium-pricing.md)

---

### 2. Quyền lợi, copy app & admin

Mục tiêu: người học và Apple hiểu **đúng** những gì trả tiền / không trả tiền; admin một nguồn sự thật.

- [x] **Danh sách quyền lợi** (*Quyền lợi Premium*): sửa perk Đàm thoại — không còn `{ai}` lượt/ngày kiểu cũ; mô tả **1 buổi/ngày (20 lượt)** + dòng riêng add-on (mua thêm).
- [x] **Đóng băng chuỗi:** free +1/7 ngày (max 2); Premium +1 đầu tháng (max 4) — [streak-freeze.md](streak-freeze.md).
- [x] **Placeholder** trong perk: `{n}` chấm, `{w}`/`{wFree}` viết, thêm `{aiSession}` / `{aiTurns}` hoặc copy cố định (backend trả số từ config).
- [x] **Perk add-on** (mới): ví dụ icon `chatbubbles-outline`, “Mở rộng đàm thoại AI”, body trỏ màn mua / giá 15k (khi bật IAP).
- [x] Ẩn mọi perk **Sắp có** trước khi bật paywall thật (Apple) — mặc định admin ẩn perk chưa ship.
- [x] **Bảng giá** admin: 4 gói Premium + 4 gói Add-on (giá doc); `ShowPrices` + nút mua chỉ khi IAP sẵn sàng (`IapEnabled` — chưa bật mua).
- [x] **Màn Premium** (`PremiumScreen`): section **Gói Premium** / **Mở rộng đàm thoại AI** / minh họa; quyền lợi mở rộng có **số buổi/lượt** từ API; giá tham khảo + `ShowPrices`; copy tiếng Việt (không “add-on”); chưa nút IAP.
- [x] **Tab Luyện → Đàm thoại**: empty state khi hết buổi — phân biệt free (quà/chờ streak) vs cần Premium vs cần add-on.

Chi tiết copy gợi ý: [premium-copy.md](premium-copy.md) (nháp câu).

---

### 3. Entitlement — ai được coi là Premium / Add-on

Mục tiêu: một hàm (server) trả về quyền thống nhất cho chấm, ads, viết, đàm thoại.

Doc chi tiết: [premium-entitlements.md](premium-entitlements.md).

- [x] Quy tắc **Premium gốc** (giữ logic gần hiện tại): `PremiumUntil` **hoặc** mã trung tâm còn hiệu lực **hoặc** (tuỳ chính sách) ngày từ mời bạn.
- [x] Cột / bảng mới **`ConversationAddonUntil`** (hoặc tên tương đương) — **độc lập** `PremiumUntil`.
- [x] **Admin test:** bật `PremiumUntil` / `ConversationAddonUntil` tay (không cần partner). Chính sách **mã trung tâm + add-on** → [mục 8](#8-trung-tâm--mời-bạn-sau-store--khi-có-partner) (làm sau).
- [x] **Hết Premium gốc** → add-on ** không có hiệu lực** (dù IAP Google/Apple còn ngày — cần xử lý grace / billing retry sau).
- [x] `GET /api/me`: trả thêm flags `conversationAddon`, `premiumUntil` (optional, cho UI). `premiumSource` — chưa làm.

---

### 4. Quota đàm thoại — buổi & lượt (server)

Mục tiêu: thay `FreeDailyTurns` / `PremiumDailyTurns` đơn giản bằng **buổi/ngày + lượt/buổi**, đồng bộ quà chuỗi với Luyện.

- [x] **Config admin** (mở rộng `ConversationConfig`):  
  `FreeFirstSessionTurns`, `StreakGiftEveryDays`, `StreakGiftSessionTurns`,  
  `PremiumSessionsPerDay`, `PremiumTurnsPerSession`,  
  `AddonSessionsPerDay`, `AddonTurnsPerSession`, `AddonDailyTurnCap`,  
  `MaxTurnsPerSession` (trần kỹ thuật/buổi).
- [x] **Theo dõi theo ngày địa phương** (header `X-Utc-Offset`, giống chấm phát âm).
- [x] **First session:** một lần / user (theo `SessionKind` / `LearnerTurns`).
- [x] **Quà chuỗi 7 ngày:** tái sử dụng pattern [PracticeService](backend/FourUme.Infrastructure/Practice/PracticeService.cs) — ngày quà = 1 buổi tới 23:59, **không cộng dồn**.
- [x] **Premium gốc:** 1 buổi/ngày, 20 lượt/buổi.
- [x] **Add-on:** 3 buổi/ngày (gợi ý), 20 lượt/buổi, cap 60 lượt/ngày.
- [x] **Thứ tự tiêu buổi:** quà/first → premium → add-on.
- [x] **`GET /api/conversation/status`:** trả `sessionsAllowedToday`, `nextSessionKind`, `blockedReason`, …; legacy `dailyLimit`/`remaining` = tổng lượt/ngày.
- [x] **Migration:** `ConversationAddonUntil`, `SessionKind`; mobile mới đọc buổi/lượt — IAP chưa ship.

---

### 5. Store — SKU, nhóm subscription, giá khai báo

Mục tiêu: product ID ổn định, map 1–1 với admin/plans.

- [ ] **Quy ước product id** (ví dụ):  
  `com.fourume.app.premium.1m` … `.3m` `.6m` `.12m`  
  `com.fourume.app.conversation.1m` … `.12m`
- [ ] **Apple:** 2 **subscription groups** (Premium | Conversation add-on); add-on ** không** downgrade Premium; mô tả subscription + link privacy/terms trên Connect.
- [ ] **Google:** 2 subscription products, **base plan** 1/3/6/12 tháng; optional offer; yêu cầu **Subscriptions API** cho verify.
- [ ] Giá khai trên store **VND** khớp doc (Apple/Google có thể làm tròn tier — ghi chú chênh lệch vài đồng).
- [ ] **Restore purchases** + **Quản lý gói** (link `https://apps.apple.com/account/subscriptions` / Play).

Chi tiết checklist Connect/Play: [premium-store-setup.md](premium-store-setup.md).

---

### 6. Xác minh hóa đơn & gia hạn (backend)

Mục tiêu: chỉ server tin receipt; mobile gửi token sau khi mua.

- [ ] **Apple:** App Store Server API (hoặc verify receipt v2) + **Server Notifications V2** → cập nhật `PremiumUntil` / `ConversationAddonUntil`.
- [ ] **Google:** Play Developer API `purchases.subscriptionsv2` + **RTDN** (Pub/Sub).
- [ ] Bảng **`SubscriptionEvents`** (user, store, productId, expiresAt, raw id) — chống replay.
- [ ] **Gia hạn / hủy / billing retry / refund:** map sang entitlement; refund → cắt quyền (policy Apple).
- [ ] Endpoint nội bộ: `POST /api/billing/apple/notification`, `POST /api/billing/google/notification` (secret).
- [ ] Endpoint app: `POST /api/billing/restore` (authenticated).

---

### 7. Mobile — mua & restore

Mục tiêu: Expo/EAS build mới (native IAP); không Expo Go.

- [ ] Chọn thư viện (vd `react-native-iap` / `expo-iap` theo SDK 57 docs).
- [ ] Load products từ store → khớp id với backend.
- [ ] Luồng mua Premium → verify server → refresh `/api/me` + status các feature.
- [ ] Luồng mua add-on (chặn UI nếu chưa Premium).
- [ ] **Không** hiển thị giá VND hardcode nếu store trả localized price (ưu tiên giá store).
- [ ] EAS env / không commit shared secret.

---

### 8. Trung tâm & mời bạn — **sau store / khi có partner**

Không bắt buộc trước bản IAP consumer. Khi bạn **đã có trung tâm**, quay lại doc này + [premium-entitlements.md](premium-entitlements.md).

- [ ] **Mời bạn (đã có sẵn):** +7 ngày `PremiumUntil` — **không** kèm add-on (mặc định doc).
- [ ] **Mã trung tâm:** chốt A/B/C trong entitlements (mặc định **A**: chỉ premiumCore, add-on tự mua 15k).
- [ ] **IELTS tab:** vẫn theo partner, không lẫn IAP consumer.

---

### 9. Store listing, web & privacy

- [ ] [store-listing.md](store-listing.md): đoạn “chưa bán Premium” → có subscription + add-on; App Review Notes cập nhật.
- [ ] [site/privacy](../site/privacy/index.html): mục **Thanh toán / subscription**, dữ liệu gửi Apple/Google.
- [ ] Trang **Điều khoản subscription** (link trên store bắt buộc): có thể thêm `site/terms/` hoặc mục trong privacy — [site.md](site.md).
- [ ] **App Privacy / Data safety:** Purchases nếu store yêu cầu.

---

### 10. Kiểm thử & phát hành

- [ ] Sandbox Apple + license tester Google.
- [ ] Case: mua Premium → dùng 1 buổi → mua add-on → hết ngày reset buổi.
- [ ] Case (khi có partner): partner Premium + user mua add-on cá nhân.
- [ ] Case: refund / hết hạn / restore trên máy mới.
- [ ] **Feature flag** admin: bật IAP từng nền (iOS trước).
- [ ] Ship: **build store mới** (native IAP) + **OTA không đủ** nếu chưa có module IAP trong binary.

---

## Thứ tự code gợi ý (tóm tắt)

1. **Backend quota đàm thoại** (mục 4) + mobile hiển thị status — **chưa IAP**; test bằng admin (+ mời bạn nếu cần).  
2. **Entitlement** add-on (mục 3) — admin set tay `ConversationAddonUntil` để test.  
3. **Copy & Premium screen** (mục 2).  
4. **Store SKU + verify** (mục 5–6) + **mobile IAP** (mục 7).  
5. **Listing & privacy** (mục 9) → submit bản **1.x** có IAP.  

---

## Liên quan

| Doc | Nội dung |
|-----|----------|
| [premium-pricing.md](premium-pricing.md) | Giá + lượt chốt |
| [premium-entitlements.md](premium-entitlements.md) | Premium vs partner vs add-on |
| [premium-copy.md](premium-copy.md) | Nháp câu UI |
| [premium-store-setup.md](premium-store-setup.md) | Checklist Connect / Play |
| [invites.md](invites.md) | Mời bạn, trung tâm |
| [ads.md](ads.md) | Ads vs Premium |
| [todo.md](todo.md) | Phase 2 |
