# Góp ý & hỗ trợ (ticket)

Người học gửi góp ý / báo lỗi trong app, 4UME trả lời trên web admin, hai bên nhắn qua lại trong cùng một góp ý đến khi đóng.

## Luồng

1. **App:** chuông ở góc phải Trang chủ (thay avatar cũ) → *Góp ý & hỗ trợ* (danh sách góp ý của mình) → *Gửi góp ý mới*. Cũng mở được từ nút *Gửi góp ý* trong Cài đặt, và **"Báo lỗi từ này"** ở mặt sau thẻ từ / bảng kết quả Ôn tập (tự chọn loại *Nội dung sai* và gắn từ).
2. Mỗi góp ý: loại (*Góp ý / Báo lỗi / Nội dung sai / Khác*), nội dung (≤ 2000 ký tự), tối đa **3 ảnh** mỗi lần gửi. App tự kèm phiên bản, hệ điều hành, đời máy.
3. **Email** báo về các địa chỉ trong *Cài đặt góp ý* (mặc định `lamvo1978@gmail.com`), có link thẳng tới góp ý trên admin. Người dùng nhắn thêm cũng có email *Trả lời thêm*. Gửi mail lỗi không chặn việc lưu góp ý.
4. **Admin** trang *Góp ý* (`/feedback`): danh sách theo trạng thái (*Đang mở, Chưa đọc, Chờ trả lời, Đã trả lời, Đã đóng*), tìm theo nội dung / tên / email, lọc loại. Menu *Góp ý* có số đỏ = góp ý có tin mới của người dùng (tự làm mới mỗi phút).
5. Trong góp ý: luồng tin nhắn kèm ảnh, người gửi (link trang người dùng), từ được báo (link trang sửa từ), thiết bị. Trả lời bằng tay hoặc chèn **câu trả lời mẫu**; *Gửi trả lời* hoặc *Trả lời & đóng*; *Đóng góp ý* / *Mở lại*.
6. **App:** có trả lời mới → chuông hiện chấm đỏ kèm số (làm mới mỗi lần về Trang chủ). Mở góp ý → đọc, nhắn thêm (kèm ảnh), hoặc bấm **Đã giải quyết**.

## Trạng thái

| Trạng thái | Nghĩa |
| --- | --- |
| `open` | Chờ 4UME trả lời (mới gửi, hoặc người dùng vừa nhắn thêm) |
| `answered` | 4UME đã trả lời, chờ người dùng |
| `closed` | Đã đóng: người dùng bấm *Đã giải quyết*, admin đóng, hoặc **tự đóng** sau *N* ngày (mặc định 14) ở trạng thái `answered` mà người dùng không nhắn thêm |

Góp ý đã đóng thì người dùng không nhắn thêm được (app gợi ý *Gửi góp ý mới*); admin có thể *Mở lại*.

## Giới hạn

- Mỗi người tối đa *N* góp ý **mới** mỗi 24 giờ (mặc định 5, sửa trong *Cài đặt góp ý*); tổng tin nhắn (mới + trả lời) ≤ 30 mỗi 24 giờ.
- Ảnh: tối đa 3 ảnh / tin, mỗi ảnh ≤ 15 MB; server thu về WebP cạnh dài ≤ 1600 px, lưu ở `/media/feedback/<guid>.webp` (tên ngẫu nhiên, không đoán được).

## Cài đặt góp ý (`/feedback/settings`)

Email nhận (tối đa 5), câu trả lời mẫu (tối đa 20), số góp ý mới mỗi ngày, số ngày tự đóng. Lưu trong `AppSettings` khoá `feedback`, có *Mặc định* và lịch sử như các trang cài đặt khác.

## Quyền riêng tư

Xoá tài khoản thì xoá luôn mọi góp ý, tin nhắn và ảnh đính kèm của người đó. Cần nêu trong chính sách quyền riêng tư: nội dung góp ý, ảnh chụp màn hình người dùng tự đính kèm, phiên bản app / đời máy.

## API

Người học (cần đăng nhập): `GET /api/feedback`, `GET /api/feedback/unread`, `GET /api/feedback/{id}` (đánh dấu đã đọc), `POST /api/feedback` (multipart: `category, body, wordId?, appVersion, platform, device, images[]`), `POST /api/feedback/{id}/messages` (multipart: `body, images[]`), `POST /api/feedback/{id}/resolve`.

Admin: `GET /api/admin/feedback?status=&category=&q=&page=`, `GET /api/admin/feedback/counts`, `GET /api/admin/feedback/{id}`, `POST /api/admin/feedback/{id}/messages` (`{ body, close }`), `POST /api/admin/feedback/{id}/close|reopen`, `GET|PUT /api/admin/feedback-settings`, `POST /api/admin/feedback-settings/reset`.

## Để sau

- Thông báo đẩy khi có trả lời (cần bản build EAS).
- Dùng chuông để chứa cả thông báo chung từ 4UME (tin tức, cập nhật).
