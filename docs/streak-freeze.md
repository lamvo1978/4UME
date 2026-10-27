# Đóng băng chuỗi ngày học

Cơ chế giữ **chuỗi ngày học** khi lỡ một ngày không học. App **tự dùng** lượt (không bấm tay).

Liên quan: [premium-pricing.md](premium-pricing.md), quyền lợi *Thêm lượt đóng băng chuỗi* trên màn Premium.

---

## Chốt (cập nhật 27/10/2026)

| | Miễn phí | Premium gốc |
|---|----------|-------------|
| **Cách nhận +1** | Mỗi **7 ngày chuỗi** (7, 14, 21…) khi học | **Lần học đầu** trong tháng (local) |
| **Tối đa dự trữ** | **2** | **4** |
| **Lỡ tối đa liên tiếp** (tự cứu chuỗi) | 2 ngày (nếu đủ lượt) | 4 ngày (nếu đủ lượt) |

**Premium gốc** = `premiumCore` ([premium-entitlements.md](premium-entitlements.md)).

**Hết Premium:** trần và cách nhận lượt theo cột miễn phí; lượt đang có không bị trừ khi hết Premium.

Ngày “đóng băng” hiện trên biểu đồ tuần (tuyết), **không** tính là ngày học thật trong thống kê.

---

## Config admin

**Web admin → Cài đặt → Đóng băng chuỗi** (`/settings`), lưu `AppSettings` key `streakFreeze`:

| Trường | Mặc định | Ý nghĩa |
|--------|----------|---------|
| `freezeEvery` | 7 | Miễn phí: +1 khi chuỗi chia hết cho N |
| `premiumMonthlyGrant` | true | Premium: +1 lần học đầu tháng |
| `maxFreezesFree` | 2 | Trần dự trữ + ngày lỡ liên tiếp (free) |
| `maxFreezesPremium` | 4 | Trần dự trữ + ngày lỡ liên tiếp (Premium) |

- Lịch sử / khôi phục: entity `settings` · `streakFreeze`.
- App: `GET /api/config` → `streakFreeze`; stats → `maxFreezes`, `freezeEvery`, `freezeOnStreak`.
- **Người dùng → chi tiết:** chỉnh tay **Lượt đóng băng** (0–10), có audit.

Code: `StreakFreezeConfig`, `ActivityService`, `StreakRules` (default khi chưa lưu admin).

---

## Copy & store

- [store-listing.md](store-listing.md): “chuỗi ngày học (có ngày đóng băng)” — vẫn đúng.
- Popup app: `StreakCard` (số N và trần từ API).
