# Khung bài học ngữ pháp

Mỗi bài ngữ pháp là **một tài liệu JSON** theo khung dưới đây. Cùng một khung được dùng cho:

- file nạp sẵn `backend/data/grammar/*.json` (mỗi bài một file),
- bảng `GrammarLessons` trong database (nội dung lý thuyết và bài tập lưu dạng `jsonb`),
- API trả về cho app, và web admin sau này (thêm / sửa / ẩn bài).

## Thông tin bài

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| `slug` | ✔ | Mã bài, chữ thường, gạch nối (`present-simple`). Không đổi sau khi đã có người học. |
| `version` | ✔ | Số nguyên. Khi khởi động, backend chỉ ghi đè bài trong DB nếu `version` trong file **lớn hơn**. Admin sửa bài thì tăng version trong DB. |
| `titleVi` | ✔ | Tên bài tiếng Việt. |
| `titleEn` |  | Tên tiếng Anh (`Present simple`). |
| `level` | ✔ | `A1` · `A2` · `B1` · `B2`. |
| `order` | ✔ | Thứ tự trong lộ trình (tăng dần). |
| `summaryVi` | ✔ | 1–2 câu tóm tắt bài. |
| `quizSize` |  | Số câu mỗi lượt luyện tập (mặc định 8). Kho bài tập nên có ≥ `quizSize + 4` câu để mỗi lần làm lại khác nhau. |
| `published` |  | `false` để ẩn bài (mặc định `true`). |
| `sections` | ✔ | Phần lý thuyết, danh sách khối theo thứ tự hiển thị. |
| `exercises` | ✔ | Kho bài tập. |

## Khối lý thuyết (`sections`)

Mỗi khối có `type` và `title` (tuỳ chọn, có tiêu đề mặc định theo loại). Ví dụ song ngữ dùng chung dạng `{ "en": "...", "vi": "..." }`.

| `type` | Trường | Hiển thị |
|---|---|---|
| `usage` | `items: [{ textVi, example? }]` | Cách dùng, mỗi ý kèm ví dụ. |
| `formula` | `rows: [{ kind, pattern, example? }]` — `kind`: `affirmative` · `negative` · `question` · `short-answer` · `note` | Công thức theo dạng câu. |
| `table` | `headers: string[]`, `cells: string[][]` | Bảng chia động từ, đại từ… |
| `examples` | `items: [{ en, vi }]` | Ví dụ có nút nghe. |
| `signals` | `words: string[]` | Dấu hiệu nhận biết (`every day`, `now`…). |
| `mistakes` | `items: [{ wrong, right, noteVi? }]` | Lỗi hay gặp: câu sai → câu đúng. |
| `tip` | `textVi` | Mẹo ghi nhớ / lưu ý. |

## Bài tập (`exercises`)

Trường chung: `id` (duy nhất trong bài, ví dụ `ps-01`), `type`, `explanationVi` (giải thích hiện sau khi trả lời).

| `type` | Trường riêng | Cách làm trên app |
|---|---|---|
| `mcq` | `prompt`, `options: string[]`, `answer` (trùng một option) | Chọn 1 đáp án. Dùng được cho cả "chọn câu đúng" (options là câu). |
| `fill` | `prompt` có `___`, `answers: string[]` (mọi đáp án chấp nhận) | Gõ từ còn thiếu. **Luôn gợi ý từ gốc trong ngoặc** nếu có thể có nhiều đáp án: `He ___ (speak) English.` |
| `order` | `promptVi` (câu tiếng Việt), `answer` (câu đúng), `distractors?: string[]` | Chạm các mảnh từ để ghép câu. Mảnh = `answer` tách theo khoảng trắng (+ mảnh gây nhiễu). |
| `transform` | `instructionVi`, `source`, `answer`, `distractors?` | Đổi câu (phủ định, nghi vấn, bị động…) bằng cách ghép mảnh như `order`. |
| `error` | `sentence` với từ sai đặt trong `[ ]`, `correction` | Chạm vào từ sai. Ví dụ: `"She [are] a doctor."`, `correction: "is"`. |

Quy tắc chấm: không phân biệt hoa thường, bỏ khoảng trắng thừa, coi `’` như `'`; với `fill` bỏ dấu câu ở cuối.

## Học và ôn

- Mỗi lượt luyện tập lấy ngẫu nhiên `quizSize` câu, xen kẽ các dạng. Câu sai quay lại cuối lượt.
- Làm đúng ngay lần đầu ≥ 70% số câu → bài được đưa vào **lịch ôn** (cấp 1, ôn sau 1 ngày) giống từ vựng.
- Mỗi lượt ôn lấy vài câu từ mỗi bài đến hạn, trộn lẫn. Lên cấp / giữ cấp / về cấp 1 theo cùng quy tắc với từ vựng (0 lỗi / 1 lỗi / ≥ 2 lỗi).

## Ví dụ rút gọn

```json
{
  "slug": "to-be",
  "version": 1,
  "titleVi": "Động từ to be",
  "titleEn": "The verb to be",
  "level": "A1",
  "order": 1,
  "summaryVi": "am / is / are dùng để nói ai đó là ai, ở đâu, như thế nào.",
  "sections": [
    { "type": "table", "title": "Chia theo chủ ngữ", "headers": ["Chủ ngữ", "to be"], "cells": [["I", "am"], ["He / She / It", "is"], ["You / We / They", "are"]] },
    { "type": "mistakes", "items": [{ "wrong": "I student.", "right": "I am a student.", "noteVi": "Tiếng Anh không bỏ to be." }] }
  ],
  "exercises": [
    { "id": "tb-01", "type": "mcq", "prompt": "I ___ a teacher.", "options": ["am", "is", "are"], "answer": "am", "explanationVi": "I đi với am." },
    { "id": "tb-02", "type": "fill", "prompt": "She ___ (be) at home.", "answers": ["is"], "explanationVi": "She đi với is." },
    { "id": "tb-03", "type": "order", "promptVi": "Họ là bạn bè.", "answer": "They are friends.", "distractors": ["is"], "explanationVi": "They đi với are." },
    { "id": "tb-04", "type": "error", "sentence": "She [are] a doctor.", "correction": "is", "explanationVi": "She đi với is." },
    { "id": "tb-05", "type": "transform", "instructionVi": "Chuyển sang câu phủ định", "source": "He is tired.", "answer": "He is not tired.", "distractors": ["does"], "explanationVi": "Thêm not sau to be." }
  ]
}
```
