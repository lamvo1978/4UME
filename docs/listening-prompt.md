# Nhờ Cursor viết bài nghe

Cách thêm nhiều bài nghe một lúc: dán prompt bên dưới vào chat Cursor (sửa phần **Yêu cầu**), Cursor viết bài, kiểm tra rồi lưu thành **một file JSON**. Bạn vào web admin → *Bài nghe* → nút `{ }` → **Nhập từ file JSON**, chọn file đó, xem trước rồi lưu. Sau đó mở từng bài đọc lại → **Tạo âm thanh** → bật *Hiện trong app*.

> Muốn viết nhanh một bài ngay trong admin (cả trên điện thoại) thì dùng nút **AI viết nháp** (Gemini) — xem [listening.md](listening.md).

## Prompt mẫu (copy toàn bộ khung này)

```text
Viết thêm bài nghe cho Góc nghe 4UME, làm theo docs/listening-prompt.md.

Yêu cầu:
- Số bài: 5
- Cấp độ: A2
- Thể loại: 3 hội thoại, 1 câu chuyện, 1 bản tin
- Chủ đề: mua sắm, du lịch (để trống thì bạn tự chọn chủ đề chưa có)
- Độ dài: vừa (12–18 câu mỗi bài)
- Mong muốn thêm: (không có)
```

Nếu trên VPS đã có bài thêm qua admin mà máy Mac không có: trước khi nhờ, vào admin → *Bài nghe* → `{ }` → **Xuất tất cả bài**, lưu file vào `drafts/listening/` để Cursor biết mà tránh trùng.

## Cursor làm theo các bước

1. **Xem bài đã có** để không trùng tên / tình huống: `backend/data/listening/*.json`, các file trong `drafts/listening/` (bản xuất từ VPS, nếu có), và `GET /api/admin/listening` trên API local nếu đang chạy.
2. **Viết bài** đúng khung và quy tắc bên dưới.
3. **Kiểm tra** bằng API local: `POST /api/admin/listening/import` với `{ "lessons": [...], "commit": false }` (chỉ xem trước, không lưu). Sửa đến khi mọi bài là *Mới* và không còn lỗi. Không chạy được API local thì tự rà theo các giới hạn bên dưới.
4. **Lưu** tất cả bài thành **một mảng JSON** trong `drafts/listening/<yyyy-mm-dd>-<mô-tả>.json` (thư mục `drafts/` git bỏ qua). Không commit, không đụng database.
5. **Báo lại**: đường dẫn file; bảng các bài (tên Việt, cấp, thể loại, số câu, số ký tự tiếng Anh); tổng ký tự ước tính cho Azure (≈ ký tự tiếng Anh + 60 × số câu).

## Khung một bài

```json
{
  "slug": "returning-a-jacket",
  "version": 1,
  "titleEn": "Returning a Jacket",
  "titleVi": "Đổi chiếc áo khoác",
  "kind": "dialogue",
  "level": "A2",
  "topic": "Mua sắm",
  "order": 21,
  "summaryVi": "Minh mang chiếc áo khoác bị hỏng khoá kéo ra cửa hàng để đổi.",
  "published": false,
  "speakers": [
    { "key": "minh", "name": "Minh", "voice": "en-US-GuyNeural" },
    { "key": "clerk", "name": "Shop assistant", "voice": "en-US-JennyNeural" }
  ],
  "lines": [
    { "speaker": "clerk", "en": "Good morning! How can I help you?", "vi": "Chào buổi sáng! Tôi có thể giúp gì cho anh?" },
    { "speaker": "minh", "en": "Hi. I bought this jacket last week, but the zip is broken.", "vi": "Chào chị. Tôi mua chiếc áo khoác này tuần trước, nhưng khoá kéo bị hỏng." }
  ]
}
```

| Trường | Quy tắc |
|---|---|
| `slug` | Chữ thường, số, gạch nối, từ tên tiếng Anh; **không trùng** bài đã có |
| `version` | `1` |
| `kind` | `dialogue` (2–3 người) · `story` (một người kể, `name: "Narrator"`) · `news` (một người đọc, `name: "Reporter"`) |
| `level` | `A1` · `A2` · `B1` · `B2` |
| `order` | Tiếp sau số lớn nhất đang có |
| `published` | `false` — bạn tự bật sau khi duyệt và tạo âm thanh |
| `speakers[].key` | Chữ thường / số, ≤ 16 ký tự, không trùng trong bài |
| `speakers[].voice` | Một trong 9 giọng: `en-US-JennyNeural` (nữ), `en-US-GuyNeural` (nam), `en-US-AriaNeural` (nữ), `en-US-DavisNeural` (nam), `en-US-AnaNeural` (bé gái), `en-GB-SoniaNeural` (nữ, Anh), `en-GB-RyanNeural` (nam, Anh), `en-AU-NatashaNeural` (nữ, Úc), `en-AU-WilliamNeural` (nam, Úc). Đúng giới tính nhân vật, mỗi người một giọng |
| `lines` | 2–80 câu; mỗi `en` ≤ 400 ký tự (nên ≤ 300); `speaker` phải là một `key` ở trên; `vi` không được trống |

## Quy tắc nội dung

- **Mục đích**: nghe thư giãn cho quen tai, dành cho người Việt trưởng thành học tiếng Anh. Không câu hỏi, không chấm điểm. Âm thanh tạo bằng giọng máy (Azure) **từng câu một**, nên mỗi câu phải đọc lên tự nhiên.
- **Đúng cấp độ**, không vượt:
  - A1: từ rất thông dụng, câu 5–10 từ, hiện tại đơn, *can*.
  - A2: từ thông dụng, câu 8–14 từ, quá khứ đơn, *going to*, nối câu đơn giản (*and, but, because*).
  - B1: thêm từ theo chủ đề, nhiều thì (cả hiện tại hoàn thành), vài câu dài hơn, cụm động từ tự nhiên.
  - B2: từ vựng phong phú, thành ngữ dùng tự nhiên, câu phức, nêu ý kiến và lý do — vẫn rõ ràng cho người học.
- **Hội thoại**: đời thường, mỗi lượt nói 1–3 câu ngắn. **Câu chuyện**: có mở – thân – kết, ấm áp, dễ theo. **Bản tin**: giọng bình tĩnh, **tự viết** về chủ đề phổ thông (thời tiết, đời sống thành phố, sức khoẻ, khoa học, công nghệ, môi trường, thể thao, văn hoá) với địa danh / nhân vật hư cấu; **không** chép hay phỏng theo tin thật, không chính trị, không tai nạn, không thương hiệu hay người nổi tiếng thật.
- Nội dung thân thiện, tích cực hoặc trung tính, hợp mọi lứa tuổi; gần gũi với đời sống người Việt (bối cảnh nước ngoài cũng được).
- Tiếng Anh tự nhiên, đúng dấu câu; không markdown, không chú thích sân khấu, không emoji. Số, giờ, giá viết theo cách đọc khi cần cho giọng máy (*seven thirty*, *twelve dollars*).
- Hội thoại và câu chuyện dùng dạng rút gọn như người bản xứ nói (*I'm, it's, don't, can't, I'd like*) ở mọi cấp độ; bản tin có thể trang trọng hơn.
- **`vi`** dịch tự nhiên theo nghĩa (không dịch từng chữ), giữ tên riêng tiếng Anh, xưng hô hợp ngữ cảnh. **`summaryVi`** 1–2 câu tả tình huống, không kể hết kết. **`topic`** là nhãn tiếng Việt ngắn (*Mua sắm*, *Du lịch*, *Sức khoẻ*…).
- Độ dài: **ngắn** 8–12 câu (~100–150 từ), **vừa** 12–18 câu (~150–250 từ), **dài** 18–26 câu (~250–400 từ).
