# Premium — giá và lượt (chốt 27/10/2026)

Tài liệu chính sách trước khi làm **In‑App Purchase**. App Store **1.0** vẫn không bán trong app; Premium qua mời bạn / mã trung tâm / admin. Khi bật IAP, giá store = giá dưới đây (+ phí Apple/Google).

**Các phần sau giá + lượt (entitlement, store, code):** [premium-iap-roadmap.md](premium-iap-roadmap.md).

**Hai sản phẩm subscription (dự kiến):**

1. **Premium gốc** — chấm phát âm, luyện viết, không quảng cáo, **1 buổi đàm thoại AI/ngày**.
2. **Add-on Đàm thoại AI** — chỉ mua khi đã có Premium gốc; thêm buổi/lượt chat (admin).

---

## Giá Premium gốc (VND)

| Gói | Giá | VND/tháng | Ghi chú |
|-----|-----|-----------|---------|
| 1 tháng | 19.000 | 19.000 | |
| 3 tháng | **54.000** | 18.000 | Không dùng 49k (49×2 > 99k gói 6 tháng) |
| 6 tháng | 99.000 | 16.500 | Mặc định code |
| 12 tháng | 159.000 | 13.250 | Nhãn “Tiết kiệm nhất” |

---

## Giá Add-on Đàm thoại (VND)

| Gói | Giá | VND/tháng |
|-----|-----|-----------|
| 1 tháng | **15.000** | 15.000 |
| 3 tháng | 39.000 | 13.000 |
| 6 tháng | 72.000 | 12.000 |
| 12 tháng | 120.000 | 10.000 |

Combo tham chiếu: Premium + Add-on ≈ **34.000/tháng** (19 + 15).

---

## Lượt — chấm phát âm & luyện viết (Premium gốc)

Giữ mặc định admin hiện tại ([pronunciation.md](pronunciation.md), [writing.md](writing.md)):

| | Miễn phí | Premium gốc |
|---|----------|-------------|
| Chấm Azure (chi tiết) / ngày | 3 (+ tối đa 10 quảng cáo đổi lượt) | 50 |
| Luyện viết AI / ngày | 1 | 10 |
| Quảng cáo | Banner + rewarded (chấm) | Không |
| Đóng băng chuỗi | Tối đa **2**; +1 mỗi **7** ngày chuỗi | Tối đa **4**; +1 **lần học đầu tháng** ([streak-freeze.md](streak-freeze.md)) |

---

## Lượt — Đàm thoại AI

### Miễn phí

| Cơ chế | Mặc định admin (gợi ý) | Quy tắc |
|--------|------------------------|---------|
| **Lần đầu** | `FreeFirstSessionTurns` = **12** | Một buổi thử / tài khoản |
| **Quà giữ chuỗi** | `StreakGiftEveryDays` = **7** | **Giống** quà mở Luyện nghe–nói ([SentenceHub](mobile/src/screens/SentenceHubScreen.tsx)) |
| Lượt mỗi buổi (first & quà) | **12** (cùng số, chỉnh một chỗ trên admin) | |
| Ngày thường | 0 buổi | Không cộng dồn; hết ngày không dùng thì mất |

### Premium gốc

| Tham số | Giá trị chốt |
|---------|----------------|
| Buổi / ngày | **1** |
| Lượt tối đa / buổi | **20** (admin) |
| Cộng dồn buổi | **Không** |

### Add-on Đàm thoại (admin — gợi ý triển khai)

| Tham số | Mặc định gợi ý |
|---------|----------------|
| Buổi thêm / ngày | 3 |
| Lượt tối đa / buổi | 20 |
| Cap lượt / ngày (add-on) | 60 |

Giọng Azure cho reply AI: ưu tiên bật cho **add-on** (và tuỳ chọn buổi Premium gốc) — [conversation.md](conversation.md).

**Thứ tự tiêu buổi trong ngày (logic server):** quà chuỗi / first → buổi Premium gốc → buổi add-on.

---

## Việc kỹ thuật (chưa làm — Phase 2)

Chi tiết checklist: [premium-iap-roadmap.md](premium-iap-roadmap.md).

---

## Liên quan

- [premium-iap-roadmap.md](premium-iap-roadmap.md) — thứ tự doc & code
- [premium-entitlements.md](premium-entitlements.md) — Premium vs add-on vs partner
- [premium-copy.md](premium-copy.md) — nháp câu UI
- [premium-store-setup.md](premium-store-setup.md) — Connect / Play
- [todo.md](todo.md) — Phase 2 IAP
- [pronunciation.md](pronunciation.md) — lượt chấm
- [conversation.md](conversation.md) — đàm thoại
- [writing.md](writing.md) — luyện viết
- [store-listing.md](store-listing.md) — mô tả store (cập nhật khi bật bán)
