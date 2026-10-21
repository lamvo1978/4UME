# Từ trùng mặt chữ (nhiều từ loại)

`vocabulary.json` có **431 từ** viết giống nhau nhưng là nhiều mục riêng (418 từ có 2 mục, 13 từ có 3 mục), mỗi mục một từ loại, có khi khác cả cấp độ. Ví dụ:

| Từ | Các mục |
|---|---|
| answer | verb A1 "trả lời" · noun A1 "câu trả lời" |
| wave | verb B1 "vẫy tay" · noun A2 "con sóng" |
| fine | adjective A1 "khỏe" · noun B1 "tiền phạt" |
| fall | noun B1 "mùa thu" · verb A2 "ngã; rơi" |
| late | adverb A1 · adjective A1, cùng nghĩa "muộn" |

## Quyết định: giữ tách riêng, không gộp

- Nhiều cặp là từ đồng âm khác nghĩa hẳn (wave, fine, fall, bow, watch). Chỉ 23 nhóm có nghĩa tiếng Việt giống hệt nhau.
- Cấp độ theo CEFR-J tính riêng từng từ loại (xem [vocabulary-cefrj.md](vocabulary-cefrj.md)). Gộp lại thì chỉ giữ được một cấp.
- Mỗi mục có lịch ôn (`WordProgress`), câu ví dụ, hình, IPA và dạng từ (`WordForms.Describe` theo từ loại) riêng. Gộp sẽ phải chuyển tiến độ học của người dùng.
- Từ điển chuẩn (Oxford, Cambridge) cũng tách mỗi từ loại thành một mục.

## Xử lý trong bài ôn

- **Nối từ với nghĩa:** mỗi bài chỉ lấy một từ cho mỗi mặt chữ (`pickMatching` trong `mobile/src/screens/ReviewScreen.tsx`). Nếu không thì hai thẻ "answer" giống hệt nhau sẽ cùng hiện, và người học không biết thẻ nào ứng với nghĩa nào. Từ bị loại vẫn ôn qua các bài đơn. Nếu sau khi lọc còn ít hơn 3 từ thì buổi đó không có bài nối.
- **Trắc nghiệm** (chọn nghĩa, chọn từ, nhìn hình): `BuildOptions` trong `backend/FourUme.Infrastructure/Review/ReviewService.cs` đã loại phương án nhiễu trùng mặt chữ hoặc trùng / chứa nghĩa của đáp án.
- Bài chọn từ và ráp từ theo nghĩa có hiện nhãn từ loại, để phân biệt nghĩa động từ với nghĩa danh từ.

## Có thể làm sau

- Trên thẻ từ, gợi ý mục cùng mặt chữ, ví dụ "Cũng là danh từ: câu trả lời (A1)".
