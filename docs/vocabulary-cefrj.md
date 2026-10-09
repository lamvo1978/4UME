# Từ vựng: đối chiếu với CEFR-J (10/2026)

> Trạng thái: **đã xong** (08/10/2026) — `vocabulary.json` version 3: **7.544 từ**, 27 bộ (A1 1.052 · A2 1.368 · B1 2.364 · B2 2.760).
>
> - Cấp độ: 1.337 từ cũ chỉnh theo CEFR-J.
> - Thêm 4.236 từ (nghĩa, IPA, ví dụ tự soạn), 4 bộ mới: Giải trí và sở thích, Nghệ thuật và văn hóa, Khoa học và môi trường, Chính trị và pháp luật.
> - Bỏ 62 mục: công nghệ lỗi thời (cassette, fax…), từ tục / xúc phạm, biến thể chính tả trùng nghĩa, dạng từ lạ. Chạy lại `scripts/cefrj.py candidates` sẽ liệt kê lại các mục này — bỏ qua chúng.
> - `vocabulary.json` là bản gốc; `data/raw` + `build_vocabulary.py` không còn dùng. Sửa file → tăng `version` để backend cập nhật DB khi khởi động.
>
> Phần dưới là kết quả đối chiếu ban đầu.

Nguồn và giấy phép: xem `backend/data/sources/README.md`.

## Hai bộ dữ liệu

| | Bộ hiện có (`vocabulary.json`) | CEFR-J 1.6 |
|---|---|---|
| Số mục | 3.308 từ, 23 bộ chủ đề | 7.801 mục (từ + từ loại) |
| A1 | 765 | 1.166 |
| A2 | 1.153 | 1.411 |
| B1 | 998 | 2.445 |
| B2 | 392 | 2.779 |

CEFR-J tính riêng từng từ loại (ví dụ `clean` tính từ A1, động từ A2), nên số mục lớn hơn số từ.

## Kết quả đối chiếu

### Từ đã có
- **2.941 / 3.308** từ khớp cả chữ và từ loại.
  - **1.604** cùng cấp.
  - **1.337** lệch cấp — gần như toàn bộ lệch **1 bậc** (A2 → B1: 290, A2 → A1: 240, B1 → A2: 217, B1 → B2: 213…). Lệch 2 bậc chỉ khoảng 160 từ.
- **49** từ khớp chữ nhưng khác từ loại.
- **318** từ không có trong CEFR-J — phần lớn là từ đời sống hiện đại, hữu ích cho người Việt (tofu, chopsticks, metro, grocery, sibling, seatbelt, số thứ tự fourth…tenth). **Giữ lại**, giữ cấp hiện tại.

### Từ còn thiếu
CEFR-J có **4.299** mục chưa có trong bộ của mình (đã bỏ trợ động từ / dạng chia của be, do, have):

| Cấp | Thiếu |
|---|---|
| A1 | 188 |
| A2 | 509 |
| B1 | 1.395 |
| B2 | 2.207 |

Đáng chú ý: thiếu cả những từ rất cơ bản — **tháng trong năm, thứ trong tuần**, autumn, box, actor, concert, basketball, dish…

CEFR-J lấy từ sách giáo khoa Trung Quốc / Hàn Quốc / Đài Loan, nên có một số từ cũ hoặc không hợp người lớn (cassette, cd player, curse, killer…) — sẽ lọc bỏ khi bổ sung.

## Đề xuất

1. **Cấp độ:** từ có trong CEFR-J → dùng cấp của CEFR-J (có nguồn để trích dẫn, nhất quán). Từ không có → giữ cấp hiện tại. Mã từ (`id`) không đổi nên tiến độ học không ảnh hưởng.
2. **Bổ sung từ theo đợt:**
   - Đợt 1: A1 + A2 (~700 từ, sau khi lọc còn khoảng 600).
   - Đợt 2: B1 (~1.400).
   - Đợt 3: B2 (~2.200) — có thể gộp với bộ chủ đề TOEIC / IELTS sau.
   - Mỗi từ: nghĩa tiếng Việt, IPA, ví dụ + câu dịch — tự soạn, cùng cấu trúc hiện tại.
3. **Xếp vào bộ chủ đề:** dùng nhãn chủ đề có sẵn trong CEFR-J (Food and drink, Travel, Work and jobs…) để xếp vào 23 bộ hiện có; thêm vài bộ mới nếu cần (ví dụ *Giải trí và sở thích*, *Đồ vật trong nhà*).
4. **Ghi nguồn trong app:** thêm mục *Nguồn dữ liệu* trong Hồ sơ.
