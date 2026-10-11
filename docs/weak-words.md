# Ôn từ hay sai

Buổi luyện riêng cho những từ người học hay quên hoặc đọc chưa chuẩn. Là một kiểu *Luyện thêm*: không đổi cấp ôn, không ảnh hưởng lịch ôn (trừ việc hẹn ôn sớm như *Luyện thêm* thường).

## Trong app

- Tab **Ôn tập → Từ vựng**: thẻ **Ôn từ hay sai · n từ** ngay dưới *Luyện nhanh 10 từ*, chỉ hiện khi có từ; link **Xem danh sách** mở màn **Từ hay sai**.
- Buổi ôn lấy tối đa 10 từ, từ bị sai nhiều nhất trước. Bài tập giống *Luyện thêm*; riêng câu **Đọc to từ này** dành cho từ có điểm phát âm gần nhất dưới 70 (tối đa 4 câu, vẫn tính lượt chấm như thường — xem [pronunciation.md](pronunciation.md)).
- Màn **Từ hay sai**: từng từ kèm nhãn *Hay quên* và / hoặc *Đọc n điểm*, chạm để nghe, nút **Ôn ngay**.

## Khi nào một từ là "hay sai"

Mỗi từ có điểm `WeakScore` (bảng `WordProgresses`):

| Sự kiện | Điểm |
|---|---|
| Trả lời có sai (ôn theo lịch, *Luyện thêm*, *Ôn từ hay sai*) | +2, tối đa 6 |
| Trả lời đúng ngay, không sai lần nào | −1, thấp nhất 0 |

Từ nằm trong danh sách khi `WeakScore > 0` **hoặc** lần chấm phát âm gần nhất dưới 70 điểm. Một lần sai cần đúng liền 2 lần mới rời danh sách; sai nhiều lần thì lâu hơn (tối đa 6 lần đúng). Đọc lại đạt từ 70 điểm thì hết nhãn *Đọc*.

Khi thêm cột (migration `WeakWords`), những từ đang có `LapseCount > 0` được đặt sẵn `WeakScore = 2`.

## Kỹ thuật

- Quy tắc điểm: `backend/FourUme.Application/Review/WeakWords.cs`; áp dụng trong `ReviewService.AnswerAsync` và `PracticeAnswerAsync`.
- API: `GET /api/review/practice?weak=true&limit=10` (mỗi mục có thêm `speakScore`), `GET /api/review/weak` (danh sách), `weakCount` trong `GET /api/review/summary`.
- App: thẻ trong `mobile/src/screens/PracticeHubScreen.tsx`, chế độ `weak` của `ReviewScreen` (`{ mode: "practice", weak: true }`), màn `mobile/src/screens/WeakWordsScreen.tsx`.
- Điểm từng âm của mỗi lần chấm phát âm được lưu ở cột `PronunciationAttempts.Phonemes` (JSON) từ bản này, để làm **thống kê âm hay sai** sau.
