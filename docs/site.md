# Trang web 4ume.io.vn

Trang công khai của 4UME, nguồn trong `site/` (HTML tĩnh, một file `style.css`, không dùng thư viện). Đóng chung image web admin, deploy như thường — xem [deploy-vps.md](deploy-vps.md#trang-web-4umeiovn).

Xem thử trên máy: `cd site && python3 -m http.server 8093`, mở http://127.0.0.1:8093/. Form xoá tài khoản chỉ chạy được trên `https://4ume.io.vn` (cần nginx chuyển `/api/...` về API).

## Các trang

| Trang | File | Dùng cho store |
|---|---|---|
| Trang chủ `https://4ume.io.vn/` — giới thiệu, sứ mệnh, Premium, lời hứa quảng cáo, hỗ trợ (`#ho-tro`) | `site/index.html` | Apple: **Support URL** (bắt buộc), Marketing URL. Google: Website |
| Quyền riêng tư `https://4ume.io.vn/privacy/` | `site/privacy/index.html` | **Bắt buộc** cả hai store |
| Xoá tài khoản `https://4ume.io.vn/delete-account/` | `site/delete-account/index.html`, `delete.js` | Google: **bắt buộc** (mục *Data safety → Xoá tài khoản*) |

Người duyệt sẽ mở các link này, nên trang phải luôn vào được và **nói đúng như app đang làm**. Nội dung trang Quyền riêng tư phải khớp với phần khai *App Privacy* (Apple) và *Data safety* (Google).

## Những gì trang đang cam kết

Trang chủ hứa với người dùng mấy điều sau. Đổi chính sách thì sửa trang **trước** (hoặc cùng lúc) khi đổi app:

- Toàn bộ từ vựng, ngữ pháp, bài nghe, ôn tập **luôn miễn phí**; không khoá bài, không giới hạn số từ.
- Premium chỉ mở rộng phần tốn chi phí thật (ví dụ thêm lượt chấm phát âm chi tiết). Trang **không ghi số lượt** (đổi được trong admin) và **không ghi giá / cách mua**.
- Quảng cáo, nếu có: chỉ **một banner nhỏ ở cuối Trang chủ**; không chen giữa bài học / ôn / nghe; không toàn màn hình, không video bắt xem; Premium không thấy quảng cáo.
- Liên hệ chỉ qua mục *Góp ý* trong app (không ghi email). Chủ sở hữu ghi là "4UME".

## Khi nào phải sửa trang

| Thay đổi trong app | Sửa ở đâu |
|---|---|
| **Bật quảng cáo (AdMob)** | `privacy/`: thêm Google AdMob vào bên thứ ba, dữ liệu quảng cáo thu (mã quảng cáo của máy, IP…), App Tracking Transparency trên iOS. Trang chủ đã có lời hứa, chỉ kiểm tra lại cho khớp vị trí banner. Khai lại App Privacy / Data safety |
| Quảng cáo khác lời hứa (thêm vị trí, quảng cáo toàn màn hình…) | Nên tránh. Nếu buộc phải làm: sửa mục *Lời hứa về quảng cáo* trên trang chủ |
| **Bán Premium trong app** (In‑App Purchase) | `privacy/`: thêm Apple / Google xử lý thanh toán (4UME không nhận số thẻ). Trang chủ vẫn **không** ghi giá hay link mua ngoài app (Apple cấm) |
| Premium có thêm quyền lợi | Trang chủ chỉ nói chung chung, thường không phải sửa. Nếu quyền lợi mới không phải "phần tốn chi phí" thì xem lại câu "Premium chỉ mở rộng những phần thật sự tốn chi phí" |
| Có bài học / tính năng trả phí riêng | Trái với lời hứa "luôn miễn phí" — phải sửa mục *Sứ mệnh* trên trang chủ |
| Dịch vụ bên thứ ba mới (thông báo đẩy, phân tích, đăng nhập Google / Apple…) | `privacy/` mục 3 (bên thứ ba) và mục 1 (dữ liệu thu) |
| Thu thêm dữ liệu / lưu ghi âm / đổi thời gian giữ bản sao lưu (hiện 14 bản, `deploy/backup.sh`) | `privacy/` và `delete-account/` (câu "tối đa khoảng 14 ngày") |
| Đổi cách gửi góp ý / có email hỗ trợ (`hotro@`) | Trang chủ mục *Hỗ trợ*, `privacy/` mục *Liên hệ* |
| Đổi đường dẫn trong app (chuông, *Hồ sơ → Cài đặt → Gửi góp ý*, *Quên mật khẩu*) | Trang chủ mục *Hỗ trợ* |
| Đổi độ tuổi tối thiểu (hiện 13+) | `privacy/` mục *Trẻ em*, khai lại độ tuổi trên store |

Mỗi lần sửa `privacy/`: đổi **ngày hiệu lực** ở đầu trang. Thay đổi lớn (thêm quảng cáo, thu thêm dữ liệu) nên báo người dùng trong app.

## Kỹ thuật

- nginx trong image admin có khối `server_name 4ume.io.vn` (`deploy/admin-nginx.conf`), file chép vào `/usr/share/nginx/site` (`deploy/admin.Dockerfile`).
- nginx biên trên VPS (`deploy/vps/4ume.conf`): `www` → chuyển về `4ume.io.vn`; chỉ `/api/auth/login` và `/api/me/delete` đi tới API, còn lại tới image admin. CSP `default-src 'self'` — không nhúng script / font / ảnh từ trang khác (muốn nhúng thì phải sửa CSP).
- Form xoá: đăng nhập rồi gọi `POST /api/me/delete` với mật khẩu. Đăng nhập giới hạn 20 lần / 15 phút mỗi IP.
- Sửa bất kỳ file nào trong `site/` thì GitHub Actions build lại image admin.
- Icon: `favicon.png` (64px, nền trong suốt, từ `logo-emblem.png`), `favicon.ico` (32px, cho trình duyệt tự tìm), `apple-touch-icon.png` (180px, nền trắng, cắt từ `mobile/assets/icon.png`). Đổi logo thì tạo lại cả ba và chép sang `admin/public/` (trang admin dùng chung bộ icon).
