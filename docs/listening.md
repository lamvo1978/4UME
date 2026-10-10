# Góc nghe

> Trạng thái (10/10/2026): **đã làm xong** backend, web admin và app trên nhánh `feature/listening` (nhánh `main` giữ bản đang chạy trên VPS). Còn chờ: key Azure để tạo âm thanh, thử trên bản build thật, gộp vào `main`.
>
> Khi chưa có âm thanh, app đọc script bằng giọng có sẵn của điện thoại (từng câu, vẫn tô sáng câu đang đọc).

## Mục đích

Nghe **thư giãn cho quen tai**: hội thoại ngắn, câu chuyện, bản tin dễ nghe. Không ép học: không câu hỏi, không chấm điểm, không bắt buộc. Có script và bản dịch để ai muốn thì xem.

## Quyết định đã chốt

| | |
|---|---|
| Nội dung | Soạn sẵn ~20 bài mẫu (A1–B2) để có ngay; sau đó thêm dần trong web admin |
| Loại bài | `dialogue` (hội thoại 2–3 người), `story` (câu chuyện, một người kể), `news` (bản tin tự viết về chủ đề phổ thông — **không** chép tin của báo vì bản quyền) |
| Độ dài | 1–3 phút / bài (~150–400 từ) |
| Giọng đọc | **Azure Speech, gói Free F0** (500.000 ký tự / tháng miễn phí, giọng Neural). Mỗi nhân vật một giọng. Âm thanh tạo **một lần** trong admin rồi lưu mp3 trên máy chủ; nghe bao nhiêu lần cũng không tốn thêm |
| Tính vào chuỗi ngày | Công tắc trong web admin → *Cài đặt*. **Mặc định tắt** |
| Nghe khi tắt màn hình | **Có**: phát nền + điều khiển trên màn hình khoá (chạy đầy đủ trên bản build thật; Expo Go chỉ nghe khi đang mở app) |
| Mini game, thi đấu | Không làm (phần ôn tập đã có; thi đấu cần đông người dùng) |

## Người học thấy gì (app)

**Tab riêng *Nghe*** ở thanh dưới (Trang chủ · Học · Ôn tập · **Nghe** · Hồ sơ):

- Danh sách bài: tên tiếng Anh + tiếng Việt, loại (hội thoại / câu chuyện / bản tin), cấp độ, thời lượng, dấu ✓ đã nghe, ♥ đã thích.
- Lọc theo cấp độ và loại. Bài mới / chưa nghe lên trước.

**Màn nghe một bài:**

- Trình phát: phát / dừng, câu trước / câu sau, **lặp một câu**, tốc độ **0,75× / 1× / 1,25×**.
- Ba chế độ hiển thị: **Anh + Việt**, **Chỉ tiếng Anh**, **Ẩn script** (chỉ nghe).
- Câu đang đọc **tô sáng** và tự cuộn theo; bấm một câu để nghe lại từ câu đó. Hội thoại ghi tên người nói (màu riêng mỗi người).
- **Nhấn giữ** một từ trong script → hiện nghĩa nếu từ có trong kho từ (kèm phiên âm, ví dụ, nút phát âm). Khớp cả dạng biến đổi (`went` → `go`). Bấm thường vào câu thì nghe lại câu đó.
- Nghe tới ~90% bài thì tính **Đã nghe** (nếu admin bật, đồng thời tính là đã học hôm nay).
- Nút ♥ thích bài; nhớ vị trí đang nghe để quay lại nghe tiếp.
- **Màn hình khoá / chuyển app**: tiếp tục phát, hiện tên bài, phát / dừng, tua.

## Web admin

**Trang *Bài nghe*** (menu bên trái; điện thoại nằm trong *Thêm*):

- Danh sách: tên, loại, cấp độ, thời lượng, trạng thái âm thanh (*Chưa tạo / Đã tạo / Cần tạo lại*), hiện / ẩn, số người đã nghe. Kéo thả đổi thứ tự.
- Trang sửa bài:
  - Thông tin: tên Anh / Việt, loại, cấp độ, chủ đề, tóm tắt tiếng Việt, hiện / ẩn.
  - **Nhân vật**: tên + giọng đọc (chọn trong danh sách giọng Azure, có nút nghe thử).
  - **Script**: từng dòng = người nói + câu tiếng Anh + câu tiếng Việt; thêm / xoá / kéo thả; kiểm tra thiếu dịch, câu quá dài.
  - Nút **Tạo âm thanh**: gửi từng câu cho Azure, ghép thành một file mp3, lưu mốc thời gian từng câu. Báo số ký tự sẽ dùng và hạn mức còn lại trong tháng. Sửa script sau khi đã tạo thì báo *Cần tạo lại âm thanh*.
  - Nghe thử ngay trong trang, xem trước như trên app.
  - **Nhập / xuất JSON** (cùng khung với file bài mẫu) — để soạn bài ở ngoài (hoặc nhờ AI viết) rồi nhập vào.
  - Lịch sử thay đổi + khôi phục như từ vựng / ngữ pháp.
- **Cài đặt → Góc nghe**: công tắc *Nghe xong một bài được tính là đã học hôm nay* (mặc định tắt).

### Thêm bài mới

- **AI viết nháp** (nút trên trang *Bài nghe*): chọn cấp độ, thể loại, độ dài, chủ đề → Google Gemini viết bản nháp, mở sẵn trong trang soạn bài (**chưa lưu**, đang ẩn khỏi app). Đọc lại, sửa, *Tạo bài* → *Tạo âm thanh* → bật *Hiện trong app*. Máy chủ gửi kèm mục đích bài nghe, quy tắc theo cấp độ, danh sách giọng, tên các bài đã có (để tránh trùng) và một bài mẫu cùng thể loại; Gemini buộc trả đúng khung JSON.
- **Nhờ Cursor viết nhiều bài một lúc**: dán prompt mẫu trong [listening-prompt.md](listening-prompt.md), Cursor lưu một file JSON → *Nhập từ file JSON*.

#### Bật Gemini (miễn phí)

1. https://aistudio.google.com → đăng nhập tài khoản Google → **Get API key** → **Create API key** (không cần thẻ).
2. Thêm vào `.env` (máy dev và VPS, **không** gửi qua chat), rồi `docker compose up -d api`:

   ```bash
   GEMINI_API_KEY=...
   # GEMINI_MODEL=gemini-flash-latest   (mặc định, chỉ đổi khi cần)
   ```

Gói miễn phí giới hạn số lượt gọi mỗi phút / mỗi ngày (dư cho việc soạn bài); Google có thể dùng nội dung gửi lên để cải thiện dịch vụ — ở đây chỉ là bài học, không có dữ liệu người dùng.

## Dữ liệu

**`ListeningLessons`**

| Cột | Ghi chú |
|---|---|
| `Slug` (khoá) | Tạo từ tên tiếng Anh, khoá sau khi tạo |
| `TitleEn`, `TitleVi`, `SummaryVi` | |
| `Kind` | `dialogue` / `story` / `news` |
| `Level`, `Topic` | A1–B2; chủ đề tự do (gia đình, du lịch, công việc…) |
| `Speakers` (JSON) | `[{ key, name, voice }]` |
| `Lines` (JSON) | `[{ speaker, en, vi, startMs, endMs }]` — mốc thời gian có sau khi tạo âm thanh |
| `AudioUrl`, `DurationMs` | `/media/listening/<guid>.mp3`; mỗi lần tạo lại dùng tên file mới (file `/media` được cache 1 năm) |
| `AudioHash` | Băm của nội dung + giọng lúc tạo âm thanh → biết khi nào *Cần tạo lại* |
| `SortOrder`, `Published`, `EditedAt`, `CreatedAt` | Như bài ngữ pháp |

**`ListeningProgresses`**: `UserId`, `LessonSlug`, `LastPositionMs`, `CompletedAt`, `Liked`, `PlayCount`.

**Cài đặt** `AppSettings` khoá `listening`: `{ countsTowardStreak: false }` — đi theo đúng cách của cài đặt thông báo (lưu, khôi phục mặc định, lịch sử), app nhận qua `GET /api/config`.

**Chuỗi ngày**: thêm `ActivityKind.Listening` + cột `StudyDays.Listens` (thống kê). Chỉ ghi khi cài đặt bật.

**Bài mẫu**: `backend/data/listening/*.json`, seeder nạp lần đầu như ngữ pháp (không ghi đè bài đã sửa qua admin).

## API

App:

| Method | Path | |
|---|---|---|
| GET | `/api/listening` | Danh sách bài đã đăng + tiến độ của tôi |
| GET | `/api/listening/{slug}` | Bài đầy đủ (script, mốc thời gian, `audioUrl`) |
| PUT | `/api/listening/{slug}/progress` | `{ positionMs, completed?, liked? }` |

Admin: `GET/POST /api/admin/listening`, `GET/PUT/DELETE /api/admin/listening/{slug}`, `PUT /api/admin/listening/order`, `POST /api/admin/listening/{slug}/audio` (tạo âm thanh), `GET /api/admin/listening/voices`, `GET /api/admin/listening/export`, `POST /api/admin/listening/import`, `PUT /api/admin/settings/listening`, `POST /api/admin/settings/listening/reset`.

## Tạo âm thanh (Azure)

- REST `POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1`, SSML, định dạng `audio-24khz-48kbitrate-mono-mp3`.
- **Mỗi câu một request** (thêm khoảng lặng ~400 ms giữa các câu), ghép các đoạn mp3 lại; thời lượng mỗi đoạn tính từ kích thước (mp3 tốc độ bit cố định) → ra `startMs` / `endMs` từng câu.
- Gói F0 giới hạn **20 request / 60 giây** → bài 30 câu mất khoảng 1,5 phút. Chạy nền trên máy chủ, trang admin hiện tiến trình; gặp 429 thì đợi rồi thử lại.
- Đếm ký tự đã dùng trong tháng (lưu trong database) để cảnh báo trước khi chạm 500.000.
- Cấu hình: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` trong `.env` → `Speech__Key`, `Speech__Region`. Không có key thì nút *Tạo âm thanh* báo chưa cấu hình (bài vẫn đăng được nhưng app hiện "Chưa có âm thanh").

Giọng dự kiến: `en-US-JennyNeural`, `en-US-GuyNeural`, `en-US-AriaNeural`, `en-US-DavisNeural`, `en-GB-SoniaNeural`, `en-GB-RyanNeural`, `en-AU-NatashaNeural` (người kể chuyện / bản tin dùng giọng chậm, rõ).

### Đăng ký Azure Speech (miễn phí)

1. https://azure.microsoft.com/free → tạo tài khoản (cần thẻ để xác minh; gói F0 **không** trừ tiền, hết hạn mức thì chỉ dừng tới tháng sau).
2. https://portal.azure.com → *Create a resource* → tìm **Speech** (Azure AI services | Speech) → *Create*:
   - Resource group: tạo mới `4ume`
   - Region: **Southeast Asia** (Singapore)
   - Name: `fourume-speech`
   - Pricing tier: **Free F0**
3. *Review + create* → *Create* → vào resource → **Keys and Endpoint**: chép **KEY 1** và **Location/Region** (`southeastasia`).
4. Thêm vào `.env` (máy dev và VPS, **không** gửi qua chat):

   ```bash
   AZURE_SPEECH_KEY=...
   AZURE_SPEECH_REGION=southeastasia
   ```

5. Chạy lại API:
   - Máy dev: `docker compose up -d api` (ở thư mục gốc repo).
   - VPS (sau khi đã gộp vào `main` và cập nhật): `cd /opt/4ume/deploy/vps && docker compose up -d api`.
6. Web admin → *Bài nghe*: khung vàng "Chưa bật giọng đọc Azure" biến mất, hiện số ký tự đã dùng trong tháng. Mở từng bài → tab **Âm thanh** → **Tạo âm thanh** (bài 15 câu mất khoảng 1 phút). 20 bài mẫu dùng khoảng 34.000 / 500.000 ký tự của tháng.

## Chạy app với API trên máy dev

`mobile/.env.local` (git bỏ qua) trỏ app vào API thật `https://api.4ume.io.vn`. Expo nhúng nội dung file này vào app, nên muốn thử với API trên máy (cổng 5088) thì **đổi tên** file (ví dụ thành `.env.local.off`) rồi chạy `npx expo start --go -c`; đổi tên lại để dùng API thật.

## Phát nền trên điện thoại

- `expo-audio` (đã có, SDK 57): bật `enableBackgroundPlayback: true` trong plugin ở `mobile/app.json`; `player.setActiveForLockScreen(true, { title, artist: "4UME" })` để hiện trên màn hình khoá.
- Chế độ âm thanh khi nghe: phát cả khi gạt im lặng, chạy nền (`shouldPlayInBackground`).
- Cần bản build mới (đổi cấu hình native) — làm cùng lúc build để nộp cửa hàng ([app-store.md](app-store.md)).

## 20 bài mẫu dự kiến

| Cấp | Hội thoại | Câu chuyện | Bản tin |
|---|---|---|---|
| A1 | Chào hỏi người hàng xóm mới · Gọi đồ uống ở quán cà phê · Hỏi đường tới ga | Một ngày của Mai | — |
| A2 | Đặt bàn nhà hàng qua điện thoại · Mua giày ở cửa hàng · Hẹn bạn đi xem phim | Chú chó lạc đường · Chuyến đi biển đầu tiên | Dự báo thời tiết cuối tuần |
| B1 | Phỏng vấn xin việc làm thêm · Khám bệnh vì đau họng | Cuộc gọi lúc nửa đêm · Người bán hoa trên phố | Thành phố mở thêm làn xe đạp · Mẹo ngủ ngon từ các nhà khoa học |
| B2 | Bàn chuyện làm việc từ xa với sếp | Chiếc ví và người lạ tốt bụng | Công nghệ AI trong lớp học · Rác thải nhựa và các bãi biển |

Script do mình (Cursor) soạn, bạn duyệt trong admin trước khi đăng.

## Thứ tự làm

1. **Khung dữ liệu + nội dung**: bảng, seeder, 20 bài mẫu (script + dịch), API app, admin danh sách / sửa / nhập xuất / lịch sử, cài đặt *Góc nghe*.
2. **Tạo âm thanh Azure**: dịch vụ TTS, chạy nền + tiến trình, đếm ký tự, nút trong admin. *(Cần key Azure.)*
3. **App**: mục *Nghe* trong tab *Học*, danh sách, trình phát + script tô sáng + chế độ hiển thị, tiến độ / thích / nghe tiếp, tính chuỗi theo cài đặt.
4. **Phát nền + màn hình khoá**, tra nghĩa từ trong script.
5. Thử trên Expo Go + bản build, cập nhật tài liệu, gộp vào `main` khi bạn duyệt.
