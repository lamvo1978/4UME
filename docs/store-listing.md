# Hồ sơ App Store và Google Play (bản nháp 13/10/2026)

Nội dung để dán vào App Store Connect và Play Console. Đọc lại, sửa câu chữ nếu chưa ưng rồi copy. Khai dữ liệu phải khớp [trang quyền riêng tư](../site/privacy/index.html); app thêm quảng cáo / mua Premium / dịch vụ mới thì sửa cả hai — xem [site.md](site.md#khi-nào-phải-sửa-trang).

Thông tin chung:

| | |
|---|---|
| Danh mục | **Education / Giáo dục** (không cần danh mục phụ) |
| Website / hỗ trợ | `https://4ume.io.vn/` |
| Chính sách quyền riêng tư | `https://4ume.io.vn/privacy/` |
| Xoá tài khoản (Google) | `https://4ume.io.vn/delete-account/` |
| Bản quyền (Apple) | `2026 Vo Ho Xuan Lam` |
| Tài khoản demo | `lamvo1978+review@gmail.com` (mật khẩu chỉ nhập trên store, không ghi vào repo). Nên học sẵn vài từ / một bài nghe để người duyệt thấy dữ liệu. |

## Nội dung chính của app (để viết mô tả cho đúng)

- **Từ vựng**: 7.544 từ theo khung CEFR-J (A1–B2), 27 bộ chủ đề; thẻ ghi nhớ có hình, IPA, ví dụ, giọng đọc; lịch ôn lặp lại ngắt quãng; ôn riêng từ hay sai; tra từ.
- **Phát âm**: đọc to, chấm điểm từng âm (Azure); số lượt chấm mỗi ngày có giới hạn.
- **Nghe**: bài nghe A1–B2 có lời và bản dịch, phát nền được; **chép chính tả** từng câu.
- **Ngữ pháp**: 46 bài A1–B1, lý thuyết + bài tập + ôn lại.
- **Kiểm tra trình độ** lúc bắt đầu.
- **Thói quen**: mục tiêu mỗi ngày, chuỗi ngày học (có ngày đóng băng), nhắc học, tổng kết tuần.
- **Mời bạn bè** nhận ngày Premium; **mã trung tâm** cho học viên trung tâm đối tác.
- Miễn phí, không quảng cáo, không bán gói trả phí (màn Premium chỉ giới thiệu, ghi "Sắp mở đăng ký").

## App Store (App Store Connect → App Information / phiên bản 1.0)

**Name** (≤ 30): `4UME - Học tiếng Anh`

**Subtitle** (≤ 30): `Học từ vựng, phát âm tiếng Anh`

**Keywords** (≤ 100 ký tự, phẩy không dấu cách, không lặp chữ đã có trong tên / tiêu đề phụ):

```
ngữ pháp,luyện nghe,chính tả,flashcard,ôn tập,từ điển,CEFR,english,giao tiếp
```

Dài 76 ký tự / 94 byte: chữ có dấu tốn 2–3 byte, nếu App Store Connect báo quá 100 thì bớt từ cuối.

**Promotional Text** (≤ 170, sửa được mà không cần duyệt lại):

```
Mỗi ngày vài phút: học từ mới, ôn đúng lúc sắp quên, đọc to để được chấm phát âm. Hoàn toàn miễn phí, không quảng cáo.
```

**Description** (≤ 4000):

```
4UME giúp người Việt học tiếng Anh đều đặn mỗi ngày, từ những từ đầu tiên đến trình độ trung cấp.

TỪ VỰNG THEO TRÌNH ĐỘ
• Hơn 7.500 từ theo khung CEFR-J, từ A1 đến B2, chia thành 27 chủ đề gần gũi: gia đình, công việc, du lịch, ăn uống…
• Mỗi từ có phiên âm IPA, nghĩa tiếng Việt, câu ví dụ và giọng đọc chuẩn, nhiều từ có hình minh hoạ.
• Lịch ôn tập thông minh nhắc bạn ôn đúng lúc sắp quên, để nhớ lâu mà không phải học dồn.
• Tự gom những từ bạn hay sai để ôn riêng.

CHẤM PHÁT ÂM
• Đọc to một từ, 4UME chấm điểm và chỉ ra âm nào chưa chuẩn.

LUYỆN NGHE VÀ CHÉP CHÍNH TẢ
• Bài nghe ngắn theo trình độ, có lời thoại và bản dịch.
• Chép chính tả từng câu để luyện tai và luyện viết đúng.

NGỮ PHÁP DỄ HIỂU
• 46 bài ngữ pháp từ A1 đến B1, giải thích bằng tiếng Việt, kèm bài tập và ôn lại.

HỌC THÀNH THÓI QUEN
• Kiểm tra trình độ lúc bắt đầu để học đúng mức.
• Đặt mục tiêu mỗi ngày, giữ chuỗi ngày học, nhận nhắc học vào giờ bạn chọn.
• Tổng kết tuần: xem tuần qua bạn học được bao nhiêu.

MỜI BẠN BÈ
• Rủ bạn cùng học, cả hai cùng nhận thêm ngày Premium.

4UME miễn phí và không có quảng cáo. Mọi góp ý, bạn nhắn cho chúng tôi ngay trong app.
```

**What's New** (bản 1.0): `Phiên bản đầu tiên của 4UME.`

**Age Rating**: trả lời *None / No* hết → **4+**. *Unrestricted Web Access*: No. *User-generated content*: No (góp ý chỉ gửi cho 4UME, người dùng không thấy của nhau).

**App Review Information → Notes**:

```
Demo account is provided above. New accounts need an email verification code, so please use the demo account.

- Microphone is used only for pronunciation scoring when the user taps the record button. Audio is sent to Microsoft Azure Speech for scoring and is not stored.
- Notifications are optional study reminders, a weekly summary and replies to the user's feedback.
- The app is free and has no in-app purchases or ads. The "Premium" screen only describes upcoming features ("coming soon"); nothing can be bought.
- Premium days can be earned for free by inviting friends, or are provided to students of partner English centers that enroll them through an access code (Guideline 3.1.3(c), access purchased by the organization for its students). No payment is made by users in or outside the app.
- Account deletion: Profile > Settings > Delete account.
```

### App Privacy (Apple)

*Do you or your third-party partners collect data?* → **Yes**. Mọi mục bên dưới: **Linked to user = Yes** (trừ ghi chú), **Used for tracking = No**.

| Loại dữ liệu (Apple) | Mục đích | Ghi chú |
|---|---|---|
| Contact Info → **Email Address** | App Functionality | đăng ký, mã xác nhận |
| Contact Info → **Name** | App Functionality | tên hiển thị |
| User Content → **Audio Data** | App Functionality | ghi âm chấm phát âm; *Linked = No*, không lưu |
| User Content → **Photos or Videos** | App Functionality | ảnh tự đính kèm vào góp ý |
| User Content → **Customer Support** | App Functionality | nội dung góp ý |
| Identifiers → **User ID** | App Functionality | mã tài khoản (kèm báo lỗi Sentry) |
| Usage Data → **Product Interaction** | App Functionality | tiến độ học, ngày học |
| Diagnostics → **Crash Data** | App Functionality | Sentry |

Không chọn: Location, Contacts, Browsing History, Purchases, Financial Info, Health, Advertising Data, Device ID (mã nhận thông báo không tính là Device ID).

## Google Play (Play Console)

**Tên app** (≤ 30): `4UME - Học tiếng Anh`

**Mô tả ngắn** (≤ 80):

```
Học từ vựng, chấm phát âm, luyện nghe và ngữ pháp tiếng Anh mỗi ngày. Miễn phí.
```

**Mô tả đầy đủ** (≤ 4000): dùng y như *Description* của App Store ở trên.

**Thể loại**: Giáo dục. **Thẻ**: Học ngôn ngữ, Giáo dục.

**Email liên hệ**: Gmail của bạn (bắt buộc, hiện công khai trên Google Play) — đổi sang `hotro@4ume.io.vn` khi có hộp thư Zoho. **Website**: `https://4ume.io.vn/`.

### Nội dung ứng dụng (App content)

- **Chính sách quyền riêng tư**: `https://4ume.io.vn/privacy/`
- **Quảng cáo**: *Không, ứng dụng không chứa quảng cáo*.
- **Quyền truy cập ứng dụng**: *Một số chức năng bị hạn chế* → thêm hướng dẫn: tài khoản demo ở trên, ghi chú "Registration needs an email verification code; please use this account."
- **Phân loại nội dung (IARC)**: danh mục *Reference, News, or Educational*; trả lời *Không* cho bạo lực, tình dục, ngôn từ, chất kích thích, cờ bạc; *Người dùng có tương tác / chia sẻ nội dung với nhau*: Không; *Chia sẻ vị trí*: Không; *Mua hàng kỹ thuật số*: Không.
- **Đối tượng mục tiêu**: **13–15, 16–17, 18 trở lên** (không chọn dưới 13, khớp trang quyền riêng tư). *Có thể thu hút trẻ em*: Không.
- **Ứng dụng tin tức / sức khoẻ / tài chính / chính phủ**: Không.
- **Xoá tài khoản**: URL `https://4ume.io.vn/delete-account/`.
- **Quyền dịch vụ chạy nền (Foreground service)**: app khai `FOREGROUND_SERVICE_MEDIA_PLAYBACK` để bài nghe phát tiếp khi tắt màn hình. Chọn **Media playback** và mô tả:

  ```
  Listening lessons keep playing audio when the user locks the screen or switches apps. Playback starts only when the user taps Play and shows a media notification with pause controls.
  ```

  Google có thể đòi **link video** quay màn hình: mở một bài nghe, bấm phát, khoá màn hình, nhạc vẫn chạy (quay bằng điện thoại Android, tải lên YouTube để *Không công khai*). Nếu không muốn khai, phải bỏ phát nền (`enableBackgroundPlayback`) trong `app.json` rồi build lại.

### An toàn dữ liệu (Data safety)

- *Thu thập hoặc chia sẻ dữ liệu bắt buộc?* **Có**. *Mã hoá khi truyền*: **Có**. *Người dùng yêu cầu xoá được*: **Có**. *Chia sẻ với bên thứ ba*: **Không** (Azure, Resend, Expo, Sentry là nhà cung cấp dịch vụ xử lý thay 4UME, Google không tính là chia sẻ).

| Loại dữ liệu (Google) | Bắt buộc / tuỳ chọn | Mục đích | Ghi chú |
|---|---|---|---|
| Thông tin cá nhân → **Email** | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản | |
| Thông tin cá nhân → **Tên** | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản | |
| Thông tin cá nhân → **Mã nhận dạng người dùng** | Bắt buộc | Chức năng ứng dụng, Phân tích sự cố | |
| Âm thanh → **Bản ghi giọng nói** | Tuỳ chọn | Chức năng ứng dụng | *Xử lý tạm thời* = Có |
| Ảnh và video → **Ảnh** | Tuỳ chọn | Hỗ trợ khách hàng | ảnh đính kèm góp ý |
| Hoạt động trong ứng dụng → **Tương tác trong ứng dụng** | Bắt buộc | Chức năng ứng dụng | tiến độ học |
| Hoạt động trong ứng dụng → **Nội dung khác do người dùng tạo** | Tuỳ chọn | Hỗ trợ khách hàng | nội dung góp ý |
| Thông tin và hiệu suất ứng dụng → **Nhật ký sự cố**, **Chẩn đoán** | Bắt buộc | Phân tích sự cố | Sentry |
| Mã thiết bị hoặc mã khác → **Mã thiết bị hoặc mã khác** | Tuỳ chọn | Chức năng ứng dụng | mã nhận thông báo |

### Thử nghiệm kín (Closed testing)

Tài khoản cá nhân: cần **ít nhất 12 người thử, tham gia liên tục 14 ngày** rồi mới xin *Quyền truy cập phiên bản chính thức*. Người thử cần điện thoại Android và Gmail.

1. *Kiểm thử → Thử nghiệm kín* → tạo kênh, thêm danh sách email người thử (hoặc một Google Group).
2. Tải `.aab` (bản build `production`) lên kênh → gửi xét duyệt.
3. Duyệt xong, gửi **link tham gia** cho người thử: họ bấm *Tham gia*, rồi cài từ Google Play.
4. Đủ 14 ngày (đếm từ khi có đủ 12 người đã tham gia) → *Bảng điều khiển → Đăng ký phiên bản chính thức*, trả lời vài câu hỏi về đợt thử.

## Ảnh

- **iPhone 6,9"** (1320×2868) bắt buộc; 6,5" tuỳ chọn (Apple tự thu nhỏ từ 6,9"). 3–10 ảnh.
- **Android điện thoại**: 2–8 ảnh, tỉ lệ 9:16; **ảnh nổi bật** 1024×500.
- Gợi ý thứ tự: Trang chủ (chuỗi ngày + mục tiêu) → thẻ từ vựng có hình → chấm phát âm → bài nghe / chép chính tả → bài ngữ pháp → tổng kết tuần. Chụp bằng tài khoản demo, không lộ email thật.
