# Giọng đọc câu ví dụ từ vựng (Azure)

Câu ví dụ trong học từ / ôn từ trước đây dùng **TTS của điện thoại** (`expo-speech`) nên dễ nghe khó, nhất là câu dài. **Từ đơn** vẫn dùng Azure qua `/api/speech/word` như cũ.

## Phạm vi

| Thành phần | Việc |
|------------|------|
| **Admin** | Job tạo MP3 (Azure), bấm chạy thủ công, giới hạn % quota tháng; lưới **Từ vựng** hiển thị trạng thái giọng câu ví dụ |
| **Backend** | Lưu file dưới `media/word-examples/`, trả `exampleAudioUrl` khi khớp nội dung câu |
| **Mobile** | Nút nghe / tự đọc sau đúng: phát recording nếu có, không thì giọng máy |

## Giọng đọc

- **Một file MP3 / một câu ví dụ** (không hai nút Nữ/Nam như từ đơn).
- Giọng **xen kẽ nữ / nam** theo thứ tự từ trong catalog (deck → sort → id): từ A nữ, từ B nam, …
- Voice Azure: `en-US-JennyNeural` / `en-US-GuyNeural`, rate `-5%` (giống giọng từ).

## Quota Azure (F0)

- Dùng **chung** bộ đếm ký tự với bài nghe, luyện câu, giọng từ on-demand, đàm thoại.
- Toàn bộ ~7,5k câu example ≈ **~700k ký tự billed** (một lần synthesize / câu).
- Job admin có tùy chọn **`maxMonthPercent`**: chỉ xử lý từ đầu danh sách thiếu audio cho đến khi hết “ngân sách” tháng (vd. 85% = tối đa 85% `MonthlyCharLimit` trừ phần đã dùng).

### Gợi ý vận hành (giai đoạn ít user)

1. Cuối tháng, xem usage Azure trên admin (card câu ví dụ hoặc luyện câu / bài nghe).
2. Bấm **Tạo giọng đọc câu ví dụ**, nhập % cap (vd. 85) nếu muốn giữ buffer cho tính năng khác.
3. Job chạy nền (~20 request/phút F0); ~6–7 giờ nếu làm hết một lượt lớn — có thể chạy ban đêm, không bắt buộc.
4. Tháng sau quota reset → chạy tiếp phần còn thiếu.

## API admin

- `GET /api/admin/words/example-audio` — trạng thái job + số câu thiếu + usage tháng
- `POST /api/admin/words/example-audio` — body tùy chọn `{ "maxMonthPercent": 85 }`

## Câu ví dụ sửa trong admin

Khi đổi nội dung `example`, recording cũ coi là **stale** (`exampleAudioText` ≠ `example`); app fallback giọng máy cho đến khi chạy job lại. Xóa hẳn example thì xóa file audio.

## Lưới Từ vựng (`/words`)

Cột **Giọng ví dụ** (và badge trên mobile):

| Hiển thị | Ý nghĩa |
|----------|---------|
| **Azure** (teal) + nút phát | Có mp3 khớp câu example hiện tại |
| **Chưa giọng** (xám) | Có example, chưa job / chưa tới lượt |
| **Giọng cũ** (cam) | Example đã sửa sau khi tạo giọng — chạy job lại |
| **—** | Không có câu ví dụ |

Bộ lọc **Hình ảnh / bổ sung**: *Ví dụ đã có giọng Azure* · *Ví dụ chưa có giọng Azure*.

API list: `GET /api/admin/words` trả thêm `exampleAudioState` (`na` \| `none` \| `ready` \| `stale`) và `exampleAudioUrl` (khi `ready`).
