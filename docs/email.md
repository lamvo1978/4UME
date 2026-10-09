# Email: mã xác nhận đăng ký và quên mật khẩu

> Trạng thái (10/10/2026): **đang chạy trên VPS**. Gửi qua Resend từ `noreply@4ume.io.vn`, đã thử nhận được ở Gmail (vào Hộp thư đến, không vào Spam).
> Còn lại: hộp thư thật `hotro@4ume.io.vn` trên Zoho (mục [Zoho Mail](#hộp-thư-thật-zoho-mail-chưa-làm)).

## Tóm tắt

| | |
|---|---|
| Gửi mã | [Resend](https://resend.com), domain `4ume.io.vn`, region Tokyo |
| Người gửi | `4UME <noreply@4ume.io.vn>` (đặt trong `appsettings.json` → `Email:From`, không cần tạo hộp thư) |
| Trả lời thư | `EMAIL_REPLY_TO` trong `.env` (để trống cho tới khi có hộp thư Zoho) |
| Nhận thư | Chưa có. Dự kiến Zoho Mail miễn phí (`hotro@4ume.io.vn`) |
| Gói Resend | Free: 3.000 email / tháng, 100 email / ngày |

Tài khoản Resend dùng chung với TablePOS (`tablepos.io.vn`); hai domain nằm cùng một team, chung hạn mức gửi.

## Người dùng thấy gì

**Tạo tài khoản (app điện thoại)**

1. Màn *Tạo tài khoản*: tên, email, mật khẩu → **Gửi mã xác nhận**. Email đã có tài khoản thì báo "Email đã được dùng" ngay, không gửi mã.
2. Thư tiêu đề `123456 là mã xác nhận tạo tài khoản 4UME`.
3. Màn *Nhập mã xác nhận*: nhập 6 số → **Tạo tài khoản** → vào thẳng trang chủ.
4. "Gửi lại mã" mở sau 60 giây (có đếm ngược); "Đổi email" quay lại form.

**Quên mật khẩu (app và web admin)**

- App: màn *Đăng nhập* → **Quên mật khẩu?** (tự điền email đã gõ) → **Gửi mã** → nhập mã + mật khẩu mới → **Đặt lại và đăng nhập**.
- Web admin: trang đăng nhập → **Quên mật khẩu?** → cùng các bước (ô mã 6 ô riêng). Tài khoản không có quyền quản trị vẫn đổi được mật khẩu nhưng không vào được admin.
- Thư tiêu đề `123456 là mã đặt lại mật khẩu 4UME`.

> Để mã trong tiêu đề là cố ý: thấy mã ngay trên thông báo điện thoại, và mỗi lần gửi lại có tiêu đề khác nên Gmail không gộp thư cũ / mới thành một chuỗi (dễ nhập nhầm mã cũ).

> `admin@4ume.io.vn` chưa có hộp thư thật, nên **chưa** đặt lại mật khẩu bằng email cho tài khoản này được. Làm xong Zoho (tạo người dùng `admin` hoặc bí danh `admin` cho hộp thư `hotro`) thì dùng được.

Tài khoản tạo trước khi có tính năng này không bị ảnh hưởng (không bắt xác nhận lại email).

## Quy tắc

Khai báo trong `EmailCodeRules` (`backend/FourUme.Application/Auth/AuthDtos.cs`):

| Quy tắc | Giá trị |
|---|---|
| Độ dài mã | 6 chữ số, sinh ngẫu nhiên bằng `RandomNumberGenerator` |
| Hiệu lực | 10 phút |
| Nhập sai | Tối đa 5 lần, sau đó phải xin mã mới |
| Gửi lại | Sau 60 giây |
| Mỗi email | Tối đa 5 mã / giờ cho mỗi mục đích (đăng ký, đặt lại mật khẩu) |
| Mỗi IP | Tối đa 10 lần gửi mã / 15 phút (lấy IP thật từ header `CF-Connecting-IP`, không có thì IP kết nối); vượt thì trả 429 |
| Lưu trữ | Chỉ lưu mã băm HMAC-SHA256 (khoá = `JWT_KEY`), không lưu mã gốc |
| Dùng mã | Mỗi mã dùng một lần; mã mới thay mã cũ |

Thông báo lỗi (tiếng Việt, app hiện nguyên văn): "Mã không đúng. Bạn còn N lần thử.", "Mã đã hết hạn hoặc chưa được gửi. Vui lòng gửi lại mã.", "Vui lòng đợi N giây rồi gửi lại mã.", "Đã gửi mã quá nhiều lần. Vui lòng thử lại sau một giờ.", "Không có tài khoản nào dùng email này.", "Tài khoản đã bị khoá.", "Email không hợp lệ.".

## API

| Method | Path | Body | Trả về |
|---|---|---|---|
| POST | `/api/auth/register/code` | `{ email }` | `{ resendAfterSeconds, expiresInMinutes }` |
| POST | `/api/auth/register` | `{ email, password, displayName, code }` | `AuthResponse` (JWT) |
| POST | `/api/auth/password/code` | `{ email }` | `{ resendAfterSeconds, expiresInMinutes }` |
| POST | `/api/auth/password/reset` | `{ email, code, newPassword }` | `AuthResponse` (JWT, đăng nhập luôn) |

Lỗi trả `400 { error }`; vượt giới hạn IP trả `429 { error }`. `/register` **bắt buộc** có `code` từ khi có tính năng này (bản app cũ không đăng ký được nữa — mở lại app để lấy code mới).

## Code

| Phần | File |
|---|---|
| Bảng mã | `FourUme.Domain/Entities/EmailCode.cs` — bảng `EmailCodes`, mỗi cặp (email, mục đích) một dòng; migration `EmailCodes` |
| Sinh / kiểm tra mã, nội dung thư | `FourUme.Infrastructure/Auth/EmailCodeService.cs` |
| Gửi thư | `FourUme.Infrastructure/Email/ResendEmailSender.cs` (gọi `POST https://api.resend.com/emails`); interface `IEmailSender` |
| Luồng đăng ký / đặt lại | `FourUme.Infrastructure/Auth/AuthService.cs` |
| Endpoint + giới hạn IP | `FourUme.Api/Program.cs` |
| App | `mobile/src/screens/RegisterScreen.tsx`, `ForgotPasswordScreen.tsx`, `LoginScreen.tsx`, `components/CodeInput.tsx`, `components/authStyles.ts` |
| Web admin | `admin/src/pages/LoginPage.tsx` |

**Không có key Resend** (máy dev): thư không gửi đi mà in ra log API, kèm mã:

```bash
docker compose logs api | grep "Mã của bạn"
```

## Cấu hình

| Biến `.env` | Biến API | Ghi chú |
|---|---|---|
| `RESEND_API_KEY` | `Email__ResendKey` | Key quyền *Sending access*, chỉ cho domain `4ume.io.vn` |
| `EMAIL_REPLY_TO` | `Email__ReplyTo` | Tuỳ chọn, ví dụ `hotro@4ume.io.vn` |
| — | `Email__From` | Mặc định `4UME <noreply@4ume.io.vn>` trong `appsettings.json` |

Trên VPS: sửa `/opt/4ume/deploy/vps/.env` rồi `cd /opt/4ume/deploy/vps && docker compose up -d`.
**Không** gửi key qua chat / commit lên git.

## Đã cài Resend thế nào (10/10/2026)

1. Resend → *Domains* → *Add domain* `4ume.io.vn`, region **Tokyo**, Custom Return-Path `send`, tắt click / open tracking.
2. *DNS Records* → **Auto configure** (Cloudflare) → Cloudflare hỏi *Authorize DNS records from Resend* → Authorize. Đã thêm (đều **DNS only**):

   | Type | Name | Nội dung |
   |---|---|---|
   | CNAME | `send` | `send.forge.rmta.net` |
   | CNAME | `rsend` | `rsend-apne1.forge.rmta.net` |
   | TXT | `resend._domainkey` | khoá DKIM `p=MIGf…` |

   Không có bản ghi MX ở tên miền gốc, nên không đụng Zoho.
3. Vài phút sau domain chuyển **Verified**.
4. *API Keys* → tạo key `4ume-vps` (*Sending access*, domain `4ume.io.vn`) → dán vào `.env` trên VPS.
5. Thử gửi:

   ```bash
   curl -s -X POST https://api.4ume.io.vn/api/auth/password/code \
     -H 'Content-Type: application/json' -d '{"email":"lamvo1978@gmail.com"}'; echo
   ```

   Ra `{"resendAfterSeconds":60,"expiresInMinutes":10}` và Gmail nhận thư là được. Lệnh này chỉ gửi mã, không đổi mật khẩu.

## Hộp thư thật: Zoho Mail (chưa làm)

Dùng để nhận / gửi thư bằng người (ví dụ `hotro@4ume.io.vn`, `admin@4ume.io.vn`). Gói **Forever Free**: 5 người dùng, 5 GB / người, dùng qua web và app Zoho Mail (không có IMAP / POP).

1. https://www.zoho.com/mail/ → bảng giá → **Forever Free Plan** → đăng ký với domain `4ume.io.vn`.
2. Thêm bản ghi DNS trong Cloudflare (dùng tự cấu hình nếu Zoho có, không thì thêm tay):

   | Type | Name | Nội dung |
   |---|---|---|
   | TXT | `@` | mã xác minh `zoho-verification=…` |
   | MX | `@` | `mx.zoho.com` (ưu tiên 10), `mx2.zoho.com` (20), `mx3.zoho.com` (50) |
   | TXT | `@` | `v=spf1 include:zohomail.com ~all` |
   | TXT | `zmail._domainkey` | khoá DKIM Zoho tạo |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hotro@4ume.io.vn` |

   SPF của Zoho ở tên miền gốc; Resend dùng tên miền phụ `send` nên hai bên không xung đột. Nếu sau này tên miền gốc đã có một bản ghi SPF thì **gộp** thành một (`v=spf1 include:zohomail.com … ~all`), không để hai bản ghi `v=spf1`.
3. Tạo người dùng `hotro` (thêm `admin` làm bí danh nếu muốn nhận thư cho `admin@4ume.io.vn`).
4. Thêm `EMAIL_REPLY_TO=hotro@4ume.io.vn` vào `.env` trên VPS → `docker compose up -d`.

## Xử lý sự cố

| Hiện tượng | Kiểm tra |
|---|---|
| App báo "Không gửi được email lúc này" | `docker compose logs api --tail 50` tìm `Resend rejected` (key sai / hết hạn mức / domain chưa Verified) |
| Không nhận được thư | Mục Spam / Quảng cáo; Resend → *Emails* xem trạng thái (Delivered, Bounced) |
| Log có `Email:ResendKey is not set` | Thiếu `RESEND_API_KEY` trong `.env`, hoặc chưa `docker compose up -d` sau khi sửa |
| "Bạn thao tác quá nhanh…" (429) | Vượt 10 lần gửi mã / 15 phút từ một IP; đợi rồi thử lại |
| Muốn đổi thời hạn / số lần | Sửa `EmailCodeRules` rồi build lại |
