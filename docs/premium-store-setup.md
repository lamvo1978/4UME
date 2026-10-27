# Premium IAP — checklist App Store Connect & Google Play

Dùng khi triển khai [premium-iap-roadmap.md](premium-iap-roadmap.md) mục 5–6. Giá tham chiếu [premium-pricing.md](premium-pricing.md).

---

## Apple App Store Connect

### Subscription group: `premium_core`

| Product ID (gợi ý) | Thời hạn | Giá VND (chốt) |
|--------------------|----------|----------------|
| `com.fourume.app.premium.1m` | 1 month | 19.000 |
| `com.fourume.app.premium.3m` | 3 months | 54.000 |
| `com.fourume.app.premium.6m` | 6 months | 99.000 |
| `com.fourume.app.premium.12m` | 12 months | 159.000 |

- Localization **vi**: tên “4UME Premium”, mô tả ngắn theo [premium-copy.md](premium-copy.md).
- **Subscription Privacy** / link privacy URL: `https://4ume.io.vn/privacy/`
- **Review screenshot** (nếu Apple yêu cầu): màn Premium với giá.

### Subscription group: `conversation_addon`

| Product ID (gợi ý) | Thời hạn | Giá VND |
|--------------------|----------|---------|
| `com.fourume.app.conversation.1m` | 1 month | 15.000 |
| `com.fourume.app.conversation.3m` | 3 months | 39.000 |
| `com.fourume.app.conversation.6m` | 6 months | 72.000 |
| `com.fourume.app.conversation.12m` | 12 months | 120.000 |

- Mô tả: cần subscription Premium; thêm buổi đàm thoại AI.
- **Không** đặt add-on cùng group với Premium (dễ upgrade/downgrade nhầm).

### App Store Connect khác

- [ ] Paid Apps Agreement, banking, tax.
- [ ] **App-Specific Shared Secret** hoặc **App Store Connect API** key cho server.
- [ ] **Server Notifications V2** URL → backend production.
- [ ] Phiên bản app **mới** có IAP → cập nhật [store-listing.md](store-listing.md) (có subscription).
- [ ] App Review Notes: tài khoản sandbox test mua Premium + add-on.

---

## Google Play Console

- [ ] **Monetize → Subscriptions:** 2 subscription IDs (premium / conversation_addon), mỗi cái **base plans** 1/3/6/12 tháng.
- [ ] Product ID nên **trùng** Apple nếu có thể (Play cho phép package `com.fourume.app`).
- [ ] **Service account** JSON → EAS / backend verify ([todo.md](todo.md) Android submit).
- [ ] **Real-time developer notifications** → backend.
- [ ] Khai **Data safety**: Purchases nếu cần.

---

## Backend secrets (VPS / EAS)

| Biến | Mục đích |
|------|----------|
| `APPLE_IAP_*` | Verify + notifications |
| `GOOGLE_PLAY_*` | Service account, package name |
| Không commit | `.env` VPS, EAS Secrets |

---

## Sandbox test (tối thiểu)

1. Mua Premium 1 tháng → chấm 50, 1 buổi chat, no ads.  
2. Trong ngày: dùng hết 20 lượt buổi Premium → hết buổi.  
3. Mua add-on → thêm buổi theo config.  
4. Restore trên cài lại app.  
5. Hủy subscription → hết kỳ mất quyền (trừ partner/admin).

---

## Liên quan

- [premium-iap-roadmap.md](premium-iap-roadmap.md)
- [premium-pricing.md](premium-pricing.md)
