# Premium — entitlement & ưu tiên quyền

Bổ sung [premium-pricing.md](premium-pricing.md). Dùng khi code backend + `/api/me` + kiểm tra trước chấm / ads / đàm thoại / viết.

---

## Trạng thái hiện tại (code)

| Nguồn | Cách lưu | Premium? |
|-------|----------|----------|
| Admin gia hạn | `Users.PremiumUntil` | Có, tới ngày |
| Mời bạn (+7 ngày) | Cộng `PremiumUntil` | Có |
| Mã trung tâm | `PartnerCodes` + partner name trên user | Có, tới hết mã / thu hồi |
| IAP | **Chưa có** | — |

**Ads:** `GET /api/me` → `adsBanner` / rewarded: tắt khi `premium` ([AuthService](backend/FourUme.Infrastructure/Auth/AuthService.cs) + pronunciation config).

**Đàm thoại hôm nay:** `ConversationConfig.FreeDailyTurns` / `PremiumDailyTurns` (mặc định 10 / 100) — **sẽ thay** bằng mô hình buổi trong [premium-iap-roadmap.md](premium-iap-roadmap.md#4-quota-đàm-thoại--buổi--lượt-server).

---

## Trạng thái mục tiêu (Phase 2)

### Premium gốc (`premiumCore`)

User có **premiumCore** khi **một trong**:

1. `PremiumUntil > now` (IAP, admin, mời bạn), **và**  
2. **Hoặc** mã trung tâm hợp lệ (partner Premium — có thể coi là premiumCore dù `PremiumUntil` null).

**Quyền premiumCore:**

- Chấm Azure theo `PremiumDailyLimit`, không ads.
- Luyện viết theo `PremiumDailyChecks`, lịch sử đầy đủ.
- **1 buổi đàm thoại / ngày**, 20 lượt/buổi (admin).
- **Đóng băng chuỗi:** tối đa **4** lượt (+1 lần học đầu tháng); miễn phí: 2 lượt (+1 mỗi 7 ngày chuỗi) — [streak-freeze.md](streak-freeze.md).
- Không bao gồm buổi add-on extra trừ khi có add-on.

### Add-on đàm thoại (`conversationAddon`)

User có **conversationAddon** khi:

- `ConversationAddonUntil > now` (IAP hoặc admin test), **và**
- **Đang có premiumCore** (nếu Premium hết hạn → add-on **tạm không dùng** cho tới khi gia hạn Premium).

**Quyền thêm:**

- Buổi/lượt theo config add-on ([premium-pricing.md](premium-pricing.md)).

### Miễn phí (không premiumCore)

- Chấm / ads / viết: như doc hiện tại.
- Đàm thoại: **first session** (1 lần đời) + **quà chuỗi 7 ngày** (1 buổi/ngày quà, 12 lượt gợi ý); ngày khác **0 buổi**.

---

## Chính sách partner (chốt **khi có trung tâm**, sau store)

IAP Phase 2 **không phụ thuộc** mục này. Admin test add-on: set `ConversationAddonUntil` tay.

Khi onboard partner, chọn một (ghi `[x]`):

- [ ] **A (gợi ý doc):** Mã trung tâm = **chỉ premiumCore**, **không** kèm add-on. Học viên tự mua add-on 15k nếu cần.
- [ ] **B:** Một số đối tác có flag `IncludesConversationAddon` → coi như `ConversationAddonUntil` theo hạn mã.
- [ ] **C:** Admin “Bật Premium” trên user = chỉ premiumCore; tick riêng “Kèm add-on đàm thoại”.

**Trước khi code IAP:** coi **A** là mặc định; không cần build B/C cho đến khi có partner.

---

## Xung đột Premium cá nhân vs trung tâm

Giữ hành vi gần [invites.md](invites.md):

- Học viên trung tâm: UI “Học viên *tên*”.
- Nếu user **vừa** có `PremiumUntil` IAP **vừa** partner: app đã mô tả “Premium riêng tạm dừng” — IAP gia hạn `PremiumUntil`; partner vẫn cho premiumCore khi mã còn.

**Add-on IAP** trong lúc partner: **cho phép** mua add-on cá nhân (15k) miễn là premiumCore (từ partner) còn — user trả thêm cho buổi chat, trung tâm không trả.

---

## API gợi ý (mở rộng)

```text
GET /api/me
  premium: bool          // premiumCore
  premiumUntil: string?
  partnerName: string?
  conversationAddon: bool
  conversationAddonUntil: string?

GET /api/conversation/status
  // thay vì chỉ dailyLimit turns:
  sessionsAllowedToday: number
  sessionsUsedToday: number
  turnsPerSessionLimit: number
  turnsUsedInCurrentSession: number
  nextSessionKind: "none" | "first" | "streak_gift" | "premium" | "addon"
  blockedReason: "need_premium" | "need_addon" | "no_sessions_left" | null
```

---

## Liên quan

- [premium-iap-roadmap.md](premium-iap-roadmap.md) — thứ tự triển khai
- [premium-pricing.md](premium-pricing.md) — số liệu
