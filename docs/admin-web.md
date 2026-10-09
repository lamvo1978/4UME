# Web admin 4UME — kế hoạch

> Trạng thái: **giai đoạn 1–6 xong** (quyền admin, đăng nhập, layout responsive; Từ vựng, Bộ từ, Hình ảnh; Ngữ pháp; Nhập / xuất + Lịch sử; Người dùng, Tổng quan, Cài đặt; cấu hình deploy VPS — xem [deploy.md](deploy.md)). Còn lại: trang Thông báo (đi cùng thông báo giai đoạn 2).
>
> Chạy thử khi phát triển: `cd admin && npm run dev` → http://localhost:5173 (gọi API qua proxy tới :5088).
> Tài khoản admin đầu tiên cấp qua biến môi trường `Admin__Emails` trong `docker-compose.yml` (chỉ khi hệ thống chưa có admin nào).

## Quyết định đã chốt

- Làm **một web admin** (không làm admin riêng trong app điện thoại).
- **Đầy đủ tính năng thêm mới / chỉnh sửa** cho từ vựng, bộ từ, ngữ pháp, bài tập ngữ pháp, hình ảnh.
- **Responsive**: dùng thoải mái trên máy tính lẫn trình duyệt điện thoại (có thể "Thêm vào màn hình chính" như một app).
- Chạy trên **VPS Ubuntu bằng docker compose**, cùng API và database với app; có domain + SSL.

## Người dùng và phân quyền

- Đăng nhập bằng tài khoản 4UME có sẵn (cùng JWT với app).
- Thêm cột `Role` cho `User`: `user` (mặc định) · `admin`.
- **Tài khoản tạo trên app luôn là người học** (`user`), không vào được web admin. Chỉ admin mới cấp quyền admin cho người khác, hoặc tạo thẳng tài khoản quản trị trong trang Người dùng.
- Tài khoản admin đầu tiên được cấp qua biến môi trường `Admin__Emails` (danh sách email) khi khởi động, **chỉ khi chưa có admin nào**. Đã có admin thì biến này bị bỏ qua, nên một email lỡ để trong cấu hình không tự lấy lại quyền đã bị thu.
- Mọi API `/api/admin/*` kiểm tra trong database ở **mỗi request**: `Role = admin` và chưa bị khoá. Thu quyền / khoá có hiệu lực ngay, không đợi token hết hạn.
- **Khoá tài khoản**: không đăng nhập được ("Tài khoản đã bị khoá."), token cũ bị từ chối (401) ở mọi API kể cả app (kiểm tra có cache 30 giây; khoá qua admin xoá cache ngay). App tự đăng xuất khi gặp 401. Khoá cũng thu luôn quyền admin; muốn cấp lại phải mở khoá trước.
- **Tài khoản quản trị gốc** `admin@4ume.com` (khai báo cứng trong `AdminUserRules.ProtectedEmails`): không ai khoá, thu quyền được (API trả 400, trang chi tiết ẩn nút), tự xoá qua app cũng bị chặn. Mỗi lần API khởi động, nếu tài khoản này bị sửa thẳng trong database (mất quyền / bị khoá) thì tự khôi phục. Vẫn đổi mật khẩu bình thường.
- Admin không tự đổi quyền / tự khoá chính mình (tránh mất hết admin). Cấp quyền admin phải gõ lại email người nhận để xác nhận.
- Mọi lần cấp / thu quyền, khoá / mở khoá đều ghi lịch sử (xem được, không khôi phục).

## Tính năng

### 1. Tổng quan (Dashboard)

- Số từ, số bộ, số bài ngữ pháp; số từ **thiếu hình**, **thiếu câu ví dụ**, **thiếu phiên âm**.
- Số người dùng, học hôm nay, học trong 7 ngày, đăng ký mới trong 7 ngày.
- Biểu đồ 14 ngày (số người học mỗi ngày; di chuột / chạm để xem thêm đăng ký mới, từ mới, lượt ôn, câu ngữ pháp), thay đổi gần đây, người dùng mới.
- Lối tắt tới danh sách "cần bổ sung" (ví dụ: lọc nhanh các từ chưa có hình).

### 2. Bộ từ (Decks)

- Danh sách bộ: tên, cấp độ, số từ, thứ tự, trạng thái hiển thị.
- Thêm / sửa / đổi thứ tự / ẩn bộ.
- Hiện tại bộ từ chỉ là `DeckId` + `DeckTitleVi` lặp trong từng `Word` → tách thành bảng `Decks` riêng (xem *Thay đổi dữ liệu*).

### 3. Từ vựng

- **Danh sách**: tìm theo từ / nghĩa; lọc theo bộ, cấp độ, loại từ, có / không có hình, đã ẩn; phân trang.
  - Máy tính: dạng bảng, sửa nhanh ngay trên dòng.
  - Điện thoại: dạng thẻ, chạm để mở form.
- **Form từ**: từ, phiên âm, loại từ, cấp độ, nghĩa tiếng Việt, câu ví dụ + nghĩa, bộ, thứ tự, hình ảnh.
  - Nút nghe thử phát âm từ và câu ví dụ.
  - **Xem trước** như trên app: thẻ flashcard + các dạng bài luyện tập sẽ tự sinh (chọn nghĩa, chọn từ, ráp chữ, xếp câu…).
  - Cảnh báo những điều khiến từ không có đủ dạng bài: từ dài > 12 chữ cái (không có bài ráp chữ), câu ví dụ < 3 hoặc > 10 từ (không có bài xếp câu), trùng từ đã có.
- **Thêm mới**: một từ, hoặc **nhập hàng loạt** từ file Excel/CSV theo mẫu (xem trước, báo dòng lỗi, rồi mới lưu).
- **Ẩn thay vì xoá**: từ đã có người học thì không xoá cứng (giữ tiến độ của người học), chỉ ẩn khỏi bài học mới. Từ chưa ai học thì xoá được.
- **Xuất** toàn bộ từ vựng ra JSON/CSV để sao lưu.

> Bài luyện tập từ vựng **tự sinh** từ dữ liệu của từ — admin không cần soạn bài tập cho từ vựng.

### 4. Hình ảnh

- Upload từ máy tính, hoặc **chụp / chọn ảnh từ thư viện** khi dùng trên điện thoại.
- Cắt khung vuông trước khi lưu; server tự thu nhỏ (tối đa 800px) và chuyển sang WebP.
- Dán URL ảnh có sẵn cũng được.
- Thư viện ảnh: xem ảnh đã upload, ảnh chưa dùng, thay ảnh cho từ.

### 5. Ngữ pháp

- **Danh sách bài**: tên, cấp độ, thứ tự, số câu bài tập, trạng thái (hiện / ẩn), cập nhật lần cuối. Kéo thả để đổi thứ tự.
- **Thông tin bài**: slug (tự tạo từ tên tiếng Anh, khoá sau khi tạo), tên Việt / Anh, cấp độ, tóm tắt, số câu mỗi lượt (`quizSize`), hiện / ẩn.
- **Lý thuyết**: thêm / sửa / xoá / kéo thả các khối theo đúng 7 loại trong [khung bài học](grammar-lesson-schema.md): `usage`, `formula`, `table`, `examples`, `signals`, `mistakes`, `tip`. Mỗi loại có form riêng (ví dụ `table` là lưới sửa ô, `formula` có chọn dạng câu).
- **Bài tập**: thêm / sửa / xoá / nhân bản câu theo 5 loại `mcq`, `fill`, `order`, `transform`, `error`, mỗi loại một form riêng, kiểm tra ngay khi gõ:
  - `mcq`: đáp án phải trùng một lựa chọn.
  - `fill`: câu phải có `___`, có ít nhất một đáp án.
  - `error`: đúng một cụm `[ ]`, là một từ, có từ sửa.
  - `order` / `transform`: xem trước các mảnh ghép.
  - Bắt buộc có giải thích tiếng Việt.
- Cảnh báo khi kho bài tập ít hơn `quizSize + 4` câu.
- **Xem trước** bài như trên app (lý thuyết → làm thử).
- Lưu bài dùng chung bộ kiểm tra `GrammarValidator` của backend; mỗi lần lưu tự tăng `version`.
- **Nhập / xuất** bài dạng JSON (cùng khung với `backend/data/grammar/*.json`).

### 6. Người dùng

- Danh sách: tên, email, ngày tham gia, lần học gần nhất, chuỗi hiện tại, số từ đã thuộc, số bài ngữ pháp đã qua. Tìm theo tên / email; lọc *Quản trị / Đã khoá / Đang học (14 ngày) / Ngừng học*; sắp xếp mới tham gia / học gần nhất / tên.
- Trang chi tiết: chuỗi hiện tại / dài nhất, số ngày học, từ đã thuộc + từ khó, ngữ pháp, lượt đóng băng, lịch hoạt động 12 tuần, cài đặt nhắc học, thiết bị nhận thông báo.
- **Thêm tài khoản** (nút trên trang Người dùng): chọn *Quản trị* hoặc *Người học*, nhập tên, email, mật khẩu (≥ 6 ký tự, nhập lại). Dùng để tạo tài khoản chỉ để quản trị web, không cần đăng ký qua app. Ghi lịch sử "Tạo tài khoản quản trị: email".
- Cấp / thu quyền admin, khoá / mở khoá (quy tắc ở mục *Người dùng và phân quyền*).
- Không xem / sửa mật khẩu người khác. Mỗi người tự **đổi mật khẩu** của mình: nút chìa khoá cạnh tên ở góc trái dưới (máy tính) hoặc menu *Thêm* (điện thoại); dùng `POST /api/me/password` như app.

### 7. Lịch sử thay đổi

- Ghi lại ai sửa gì, lúc nào (từ, bộ, bài ngữ pháp, hình).
- Xem lại nội dung trước khi sửa, khôi phục một bản cũ.

Cách hoạt động (đã làm):

- Mỗi lần thêm / sửa / xoá / đổi thứ tự / nhập file / khôi phục ghi một dòng `AuditLogs` **trong cùng lần lưu** với thay đổi (không có chuyện sửa được mà không có lịch sử). Lần sửa không đổi gì thì không ghi.
- Mỗi dòng lưu ảnh chụp nội dung **trước** và **sau** (JSON). Từ và bộ lưu đủ các trường; bài ngữ pháp lưu cả khung bài.
- **Khôi phục** = áp lại nội dung "sau" của dòng đó (dòng xoá thì dùng nội dung "trước"). Mục đã bị xoá được tạo lại với đúng mã cũ, nên tiến độ học gắn với mã đó vẫn còn. Khôi phục cũng được ghi lịch sử, nên hoàn tác được.
- Khôi phục được: từ, bộ, bài ngữ pháp. Không khôi phục: đổi thứ tự, hình ảnh (chỉ xem).
- Xem ở trang **Lịch sử** (tìm theo từ / tên bài / mã / người sửa, lọc theo loại) hoặc nút **Lịch sử** trong trang sửa từ / bài (ngăn kéo bên phải, trên điện thoại kéo từ dưới lên). Mỗi dòng mở ra thấy trước / sau từng trường; bài ngữ pháp tóm tắt khối / câu bài tập thêm, bớt, sửa.

### Nhập / xuất (đã làm)

**Từ vựng** — trang *Từ vựng* → nút *Nhập / Xuất*:

- **Xuất** các từ đang lọc (hoặc tất cả) ra Excel, CSV (UTF-8, mở được bằng Excel) hoặc JSON. File Excel / CSV nhập lại được ngay.
- **Nhập** file `.xlsx` / `.csv` (tối đa 3.000 dòng), có **file mẫu**. Dòng 1 là tên cột, nhận tên tiếng Anh (`id, word, pos, level, deck, meaning_vi, ipa, example, example_vi, image_url, published`) hoặc tiếng Việt (`Từ, Loại từ, Cấp độ, Bộ từ / Chủ đề, Nghĩa, Phiên âm, Ví dụ, Nghĩa ví dụ, Hình, Hiện`); cột lạ bị bỏ qua và báo lại.
- Quy tắc:
  - Tìm từ đã có theo cột `id`, nếu không có thì theo cặp từ + loại từ.
  - Cột không có trong file → giữ nguyên giá trị cũ; ô để trống → xoá giá trị đó.
  - Loại từ nhận cả viết tắt (`n`, `adj`…) và tiếng Việt (`danh từ`…); bộ từ nhận mã hoặc tên bộ; `published` nhận 1/0, có/không, hiện/ẩn.
  - Tắt *Cập nhật từ đã có* thì dòng trùng từ đang có được đánh dấu "Đã có" và bỏ qua.
  - Hai dòng trong file trùng nhau → báo lỗi cả hai.
- **Xem trước** trước khi lưu: mỗi dòng có trạng thái *Thêm mới / Cập nhật / Không đổi / Đã có / Lỗi*, kèm lý do lỗi và các trường sẽ đổi. Chỉ lưu dòng thêm mới + cập nhật; dòng lỗi bị bỏ qua.

**Ngữ pháp** — trang *Ngữ pháp* → nút JSON:

- **Xuất tất cả bài** ra một file JSON (danh sách bài, cùng khung với `backend/data/grammar/*.json`).
- **Nhập** một hoặc nhiều file JSON (mỗi file là một bài hoặc danh sách bài). Bài trùng slug được cập nhật và tăng phiên bản; bài ẩn chỉ cần thông tin cơ bản, bài hiện phải qua đủ `GrammarValidator`. Có bước xem trước như từ vựng.

### 8. Thông báo

Chi tiết trong [kế hoạch thông báo](notifications.md).

- Soạn và gửi tin mới cho người dùng (ngay hoặc hẹn giờ), chọn nhóm người nhận, xem lịch sử và thống kê.

### 9. Cài đặt hệ thống

Thông số áp dụng cho mọi người dùng, sửa là có hiệu lực ngay, không cần cập nhật app:

- **Thông báo**: giờ cứu chuỗi, giờ yên tĩnh (bắt đầu / kết thúc), số thông báo tối đa mỗi ngày, chuỗi tối thiểu để gửi cứu chuỗi, các ngày gửi nhắc quay lại, giờ tổng kết tuần, giờ báo dùng lượt đóng băng. Mặc định và ràng buộc xem [notifications.md](notifications.md#thông-số-hệ-thống-chỉnh-trong-web-admin).
- Form kiểm tra ràng buộc ngay khi nhập (giờ cứu chuỗi / tổng kết tuần / báo đóng băng không rơi vào giờ yên tĩnh, tối đa 1–3 thông báo mỗi ngày…), backend kiểm tra lại khi lưu. Thanh 24 giờ minh hoạ giờ yên tĩnh và các mốc gửi; trường khác mặc định có ghi chú "Mặc định: …".
- Nút **Khôi phục mặc định** (xoá thông số đã lưu, quay về mặc định trong code).
- Mọi thay đổi được ghi vào lịch sử thay đổi và khôi phục được. App nhận thông số mới qua `GET /api/config`.

## Responsive

| | Máy tính (≥ 1024px) | Điện thoại |
|---|---|---|
| Điều hướng | Thanh menu bên trái | Thanh tab dưới đáy (Tổng quan · Từ vựng · Ngữ pháp · Thêm) |
| Danh sách | Bảng nhiều cột, sửa nhanh trên dòng | Thẻ gọn, chạm để mở |
| Form | Hai cột: form bên trái, xem trước bên phải | Một cột; xem trước mở thành tab riêng |
| Lý thuyết / bài tập ngữ pháp | Kéo thả để sắp xếp | Nút lên / xuống |
| Hình ảnh | Kéo thả file | Chụp ảnh / chọn từ thư viện |

- Nút bấm ≥ 44px, ô nhập đủ lớn để gõ trên điện thoại.
- Có trạng thái "chưa lưu" và hỏi lại khi rời trang.
- Màu sắc, font theo bộ nhận diện của app (`docs/ui/DESIGN.md`).

## Kỹ thuật

- **Frontend**: thư mục `admin/` — React + TypeScript + Vite, thư viện giao diện Mantine (form, bảng, responsive sẵn), React Query gọi API.
- **Backend**: thêm nhóm endpoint `/api/admin/*` vào API hiện có (cùng Clean Architecture).
- **Deploy**: thêm 2 service vào `docker-compose.yml`:
  - `admin`: build file tĩnh, phục vụ bằng nginx.
  - `caddy`: reverse proxy, **tự xin SSL** (Let's Encrypt), ví dụ:
    - `api.<domain>` → API
    - `admin.<domain>` → web admin
    - `/media/*` → thư mục ảnh đã upload
- Ảnh lưu trong volume Docker `fourume_media` (sau này có thể chuyển sang S3 / R2 mà không đổi API).

### API dự kiến

| Nhóm | Endpoint |
|---|---|
| Tổng quan | `GET /api/admin/overview` |
| Bộ từ | `GET/POST /api/admin/decks`, `PUT/DELETE /api/admin/decks/{id}`, `PUT /api/admin/decks/order` |
| Từ vựng | `GET /api/admin/words?q=&deck=&level=&missing=image`, `GET/PUT/DELETE /api/admin/words/{id}`, `POST /api/admin/words`, `POST /api/admin/words/import` (xem trước + xác nhận), `GET /api/admin/words/export` |
| Hình ảnh | `POST /api/admin/media` (multipart), `GET /api/admin/media`, `DELETE /api/admin/media/{id}` |
| Ngữ pháp | `GET/POST /api/admin/grammar`, `GET/PUT/DELETE /api/admin/grammar/{slug}`, `POST /api/admin/grammar/validate`, `PUT /api/admin/grammar/order`, `GET /api/admin/grammar/export`, `POST /api/admin/grammar/import` (xem trước + xác nhận) |
| Người dùng | `GET /api/admin/users?q=&filter=&sort=&page=`, `POST /api/admin/users` (`{email, displayName, password, role}`), `GET /api/admin/users/{id}`, `PUT /api/admin/users/{id}/role` (`{role}`), `PUT /api/admin/users/{id}/lock` (`{locked}`) |
| Thông báo | `GET/POST /api/admin/notifications`, `GET /api/admin/notifications/stats` (chưa làm) |
| Cài đặt hệ thống | `GET /api/admin/settings`, `PUT /api/admin/settings/notifications`, `POST /api/admin/settings/notifications/reset` |
| Lịch sử | `GET /api/admin/audit?entityType=&entityId=&q=&page=`, `GET /api/admin/audit/{id}` (trước / sau), `POST /api/admin/audit/{id}/restore` |

### Thay đổi dữ liệu

- `User`: thêm `Role`, `LockedAt`.
- Bảng mới `Decks` (`Id`, `TitleVi`, `Icon`, `SortOrder`, `Published`, `EditedAt`); `Word.DeckId` trỏ tới bảng này, bỏ `DeckTitleVi` lặp lại. Biểu tượng bộ là tên Ionicons, app hiển thị trực tiếp.
- `Word`: thêm `Published`, `EditedAt`. Mã từ (`slug-loạitừ`) không đổi sau khi tạo; loại từ đổi được (không trùng cặp chữ + loại từ, từ mới trùng mã thì thêm hậu tố `-2`, `-3`…).
- `GrammarLesson`: thêm `EditedAt`. Slug không đổi sau khi tạo. Bài **ẩn** lưu được dạng nháp (chỉ cần tên, slug, cấp độ, số câu mỗi lượt); bài **đang hiện** phải qua đủ `GrammarValidator`. Không xoá được bài đã có người học.
- Bảng mới `MediaFiles` (đường dẫn, kích thước, người upload, thời gian).
- Bảng mới `AuditLogs` (người sửa, loại, mã, nội dung trước / sau dạng JSON, thời gian).
- **Database là nguồn dữ liệu chính** từ khi có admin: `vocabulary.json` và `data/grammar/*.json` chỉ dùng để nạp lần đầu (seeder chỉ thêm cái còn thiếu, không ghi đè từ / bộ / bài ngữ pháp có `EditedAt`, tức đã sửa qua admin; đổi thứ tự cũng tính là sửa).
- Ảnh xử lý bằng SkiaSharp (giấy phép MIT): xoay theo EXIF, cắt vuông giữa (tuỳ chọn), tối đa 800px, WebP chất lượng 82. `ImageUrl` lưu đường dẫn tương đối `/media/…`; app tự ghép với địa chỉ API.
- Trang admin dùng đường dẫn `/images` (không phải `/media`) để không trùng với đường dẫn file ảnh.
- App chỉ hiển thị từ / bộ / bài có `Published = true`.

## Thứ tự làm

1. ✅ **Nền tảng**: role admin (`User.Role`, `LockedAt`), endpoint `/api/admin/me` + `/api/admin/overview`, khung `admin/` + đăng nhập + layout responsive.
2. ✅ **Từ vựng + bộ từ + hình ảnh**: migration (Decks, Published, Media), danh sách + lọc, form + xem trước + cảnh báo bài tập, upload / thư viện ảnh, ẩn / xoá, sắp xếp bộ. Chưa có: sửa nhanh trên dòng bảng (để sau nếu cần).
3. ✅ **Ngữ pháp**: danh sách + lọc cấp độ + sắp xếp, form thông tin, form 7 loại khối lý thuyết, form 5 loại bài tập (đổi loại, nhân bản, bấm chọn từ sai), xem trước lý thuyết + làm thử câu đang chọn, kiểm tra trực tiếp qua `/grammar/validate`, tải JSON từng bài. Nhập JSON để sang giai đoạn 4.
4. ✅ **Nhập / xuất** (Excel, CSV, JSON) và **lịch sử thay đổi** (bảng `AuditLogs`, trang Lịch sử, ngăn lịch sử trong trang sửa, khôi phục). Thư viện đọc / ghi Excel (`read-excel-file`, `write-excel-file`, `papaparse`, đều MIT) chỉ tải khi dùng tới.
5. ✅ **Người dùng**, **tổng quan** và **cài đặt hệ thống**: danh sách + chi tiết người dùng, cấp / thu quyền, khoá (chặn cả token cũ, app tự đăng xuất khi 401), tổng quan có biểu đồ 14 ngày, trang cài đặt thông báo có kiểm tra + lịch sử + khôi phục mặc định.
6. ✅ **Deploy**: `docker-compose.prod.yml` (Postgres + API + Caddy tự xin SSL, web admin build sẵn trong image Caddy), `.env.example`, sao lưu / khôi phục (`deploy/backup.sh`, `deploy/restore.sh`), API tắt Swagger và bắt buộc khoá JWT riêng ở Production, tự tạo `admin@4ume.com` trên database mới. Hướng dẫn: [deploy.md](deploy.md). Đã chạy thử toàn bộ trên máy với tên miền `*.localhost`.

## Câu hỏi còn mở

- Tên miền dự kiến (để cấu hình Caddy).
- Có cần nhiều cấp quyền (ví dụ "biên tập viên" chỉ sửa nội dung, không quản lý người dùng) hay chỉ một quyền admin?
- Có muốn nút **gợi ý bằng AI** (phiên âm, câu ví dụ, câu hỏi ngữ pháp) trong form không? Cần API key của nhà cung cấp AI.
