# Hồ sơ App Store và Google Play (bản nháp, cập nhật 26/10/2026 — AdMob + celebration)

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
- Miễn phí, không bán gói trả phí (màn Premium chỉ giới thiệu). Từ bản có AdMob (nhánh `feature/admob`): tài khoản miễn phí có một banner ở cuối Trang chủ và quảng cáo tự chọn xem để thêm lượt chấm phát âm; Premium không có quảng cáo. **Bản build nào có AdMob thì phải khai "có quảng cáo" ở cả hai store** (các mục đánh dấu *[AdMob]* bên dưới).

## App Store (App Store Connect → App Information / phiên bản 1.0)

**Name** (≤ 30): `4UME - Học tiếng Anh`

**Subtitle** (≤ 30): `Học từ vựng, phát âm tiếng Anh`

**Keywords** (≤ 100 ký tự, phẩy không dấu cách, không lặp chữ đã có trong tên / tiêu đề phụ):

```
ngữ pháp,luyện nghe,chính tả,flashcard,ôn tập,từ điển,CEFR,english,giao tiếp,đàm thoại AI
```

Dài 76 ký tự / 94 byte: chữ có dấu tốn 2–3 byte, nếu App Store Connect báo quá 100 thì bớt từ cuối.

**Promotional Text** (≤ 170, sửa được mà không cần duyệt lại):

```
Mỗi ngày vài phút: học từ, ôn đúng lúc, chấm phát âm. Miễn phí; không quảng cáo trong bài học. Tài khoản miễn phí có banner nhỏ ở Trang chủ và có thể tự chọn xem quảng cáo để thêm lượt chấm.
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

LUYỆN NÓI VÀ VIẾT VỚI AI
• Đàm thoại: nhập vai hoặc trò chuyện tự do, AI sửa câu và tổng kết.
• Luyện viết: viết theo đề hoặc tự do, AI chấm điểm và gợi ý sửa.

HỌC THÀNH THÓI QUEN
• Kiểm tra trình độ lúc bắt đầu để học đúng mức.
• Đặt mục tiêu mỗi ngày, giữ chuỗi ngày học, nhận nhắc học vào giờ bạn chọn.
• Tổng kết tuần: xem tuần qua bạn học được bao nhiêu.

MỜI BẠN BÈ
• Rủ bạn cùng học, cả hai cùng nhận thêm ngày Premium.

4UME MIỄN PHÍ, chưa bán Premium trong app. Quảng cáo Google AdMob chỉ ở Trang chủ (banner nhỏ) hoặc khi bạn tự chọn xem để thêm lượt chấm phát âm; không có quảng cáo trong bài học, ôn tập hay nghe. Tài khoản Premium không có quảng cáo. Góp ý: nhắn trong app.
```

**What's New** (bản 1.0 lên App Store lần đầu): `Phiên bản đầu tiên của 4UME trên App Store.`

**What's New** (bản TestFlight sau AdMob, nếu vẫn ghi 1.0.0): `Quảng cáo tùy chọn cho tài khoản miễn phí, cải thiện màn chúc mừng khi hoàn thành bài học, và các sửa lỗi nhỏ.`

**What to Test** (TestFlight, bản có Đàm thoại): `Mới: Đàm thoại với AI (tab Luyện → thẻ đầu tiên). Chọn cấp độ, trò chuyện tự do hoặc nhập vai một tình huống, bấm micro để nói hoặc gõ chữ. Thử nói sai một câu xem AI có sửa ngay không, rồi bấm Kết thúc để xem tổng kết. Góp ý cho 4UME nếu AI trả lời lạ hoặc chậm.`

**What to Test** (TestFlight, bản có Luyện viết): `Mới: Luyện viết với AI (tab Luyện → thẻ thứ hai). Chọn cấp độ, viết theo đề hoặc viết tự do một đoạn tiếng Anh, bấm Chấm bài. AI cho điểm, tô màu chỗ sai (chạm vào để xem cách sửa và giải thích), viết lại cả đoạn và gợi ý từ hay hơn. Thử cố ý viết sai vài chỗ xem AI có bắt đúng không, rồi bấm "Viết lại bài này" để sửa và chấm lại. Góp ý cho 4UME nếu AI chấm sai hoặc chậm.`

**What to Test** (TestFlight, bản có AdMob): `Mới: quảng cáo cho tài khoản miễn phí (đang là quảng cáo thử nghiệm của Google). Lần đầu gặp quảng cáo, máy hỏi có cho phép theo dõi không, chọn gì cũng được. Hết lượt chấm phát âm trong ngày, thử bấm "Xem quảng cáo để chấm bản ghi này" hoặc Hồ sơ → Thêm lượt kiểm tra. Góp ý cho 4UME nếu quảng cáo làm phiền hoặc che mất nội dung.`

**What to Test** (TestFlight, bản gộp AdMob + celebration — dán một khối): `Bật quảng cáo trên admin nếu chưa thấy banner. Thử banner ở Trang chủ và quảng cáo tự chọn khi hết lượt chấm phát âm (xem hết quảng cáo → lượt phải tăng). Hoàn thành một bài ôn hoặc giữ chuỗi ngày: xem video chúc mừng có chạy mượt không. Tab Luyện: thử Đàm thoại và Luyện viết với AI. Góp ý nếu quảng cáo che nội dung hoặc video lag.`

**Age Rating**: trả lời *None / No* hết → **4+**. *[AdMob]* Bản có quảng cáo: mục *Advertising* chọn **Yes**, vẫn ra 4+. *Unrestricted Web Access*: No. *User-generated content*: No (góp ý chỉ gửi cho 4UME, người dùng không thấy của nhau).

**App Review Information → Notes**:

```
Demo account is provided above. New accounts need an email verification code, so please use the demo account.

- Microphone is used only for pronunciation scoring when the user taps the record button. Audio is sent to Microsoft Azure Speech for scoring and is not stored.
- "Đàm thoại với AI" (Luyện tab → first card): the learner practises English by talking with an AI, as role-play (ordering coffee, a job interview…) or free talk. Speech is turned into text by iOS speech recognition; only that text is sent to a third-party AI service to write the reply and correct mistakes. No audio, name or email is sent. Before the first conversation the app shows a consent dialog explaining this (Guideline 5.1.2(i)); nothing is sent unless the user taps "Đồng ý". Replies are short, educational and the AI is instructed to refuse unsafe topics. The demo account has enough daily turns to try it.
- "Luyện viết với AI" (Luyện tab → second card): the learner writes a short English paragraph and an AI grades it (score, highlighted mistakes with Vietnamese explanations, a rewritten version). Only the paragraph (with its task and level) is sent to a third-party AI service; no name or email. A separate consent dialog is shown the first time the learner opens a writing task, before anything is written or sent (Guideline 5.1.2(i)). Paragraphs are saved so the learner can read them again and can be deleted one by one.
- Notifications are optional: study reminders, a weekly summary, replies to the user's feedback, and occasional news about new lessons or features (can be turned off in Profile > Settings > "Tin mới từ 4UME"). No promotional or marketing messages are sent.
- The app is free and has no in-app purchases. The "Premium" screen only describes Premium; nothing can be bought.
- [AdMob build only] Free accounts see Google AdMob ads: one banner pinned at the bottom of Home, and an optional rewarded ad the learner chooses to watch for one extra pronunciation check after the free daily checks run out (Profile > "Thêm lượt kiểm tra", or the button under a pronunciation exercise). No ads appear inside lessons, reviews or listening. The App Tracking Transparency prompt is shown only right before the first ad, and ads still work if the user declines. Premium accounts see no ads.
- Premium days can be earned for free by inviting friends, or are provided to students of partner English centers that enroll them through an access code (Guideline 3.1.3(c), access purchased by the organization for its students). No payment is made by users in or outside the app.
- Account deletion: Profile > Settings > Delete account.
```

### Các bước nộp trên App Store Connect

Làm sau 5–7 ngày bạn bè thử trên TestFlight. Điền trước được, chỉ bấm *Add for Review* khi đã chọn bản build cuối.

1. **Tài khoản demo** (làm trước): admin → *Người dùng* → *Thêm tài khoản* với email demo ở trên, cấp Premium (để người duyệt chấm phát âm không bị hết lượt). Đăng nhập tài khoản này trên điện thoại, học vài thẻ từ, một bài nghe, một bài ngữ pháp để màn hình có dữ liệu. Không gắn mã trung tâm (tab IELTS chỉ có chữ *Sắp có*, dễ bị coi là chưa hoàn thiện).
2. **App Information**: Name, Subtitle, danh mục *Education*, *Content Rights* → **Yes, contains third-party content** và có quyền dùng (ảnh Pexels / Pixabay, giọng đọc máy). *Age Rating* → bảng câu hỏi mới của Apple: trả lời **No / None** hết, kể cả *Messaging and Chat*, *User-Generated Content* (góp ý chỉ gửi 4UME), *Advertising* (*[AdMob]* bản có quảng cáo chọn **Yes**), *Parental Controls*, *Age Assurance* → ra **4+**.
3. **Pricing and Availability**: *Free*. Quốc gia: chỉ **Vietnam** cho lần đầu. Nếu chọn cả EU, Apple bắt khai *trader status* (Digital Services Act) và hiện công khai địa chỉ, số điện thoại.
4. **App Privacy**: Privacy Policy URL + bảng bên dưới, bấm *Publish*.
5. **Phiên bản 1.0**: ảnh `store/ios/screenshots-6.9/` (1290×2796, Apple nhận cho ô 6,9"), Promotional Text, Description, Keywords, Support URL, Copyright.
6. **Build**: chọn bản build mới nhất đã thử trên TestFlight. Mã hoá đã khai trong `app.json` (`ITSAppUsesNonExemptEncryption: false`), nên không bị hỏi.
7. **App Review Information**: *Sign-in required* → nhập email + mật khẩu demo (chỉ gõ ở đây), số điện thoại liên hệ, dán *Notes* ở trên.
8. *Version Release*: **Manually release** để tự chọn ngày lên store sau khi được duyệt. Bấm *Add for Review* → *Submit*.

### App Privacy (Apple)

*Do you or your third-party partners collect data?* → **Yes**. Mọi mục bên dưới: **Linked to user = Yes** (trừ ghi chú), **Used for tracking = No**.

| Loại dữ liệu (Apple) | Mục đích | Ghi chú |
|---|---|---|
| Contact Info → **Email Address** | App Functionality | đăng ký, mã xác nhận |
| Contact Info → **Name** | App Functionality | tên hiển thị |
| User Content → **Audio Data** | App Functionality | ghi âm chấm phát âm; *Linked = No*, không lưu |
| User Content → **Photos or Videos** | App Functionality | ảnh tự đính kèm vào góp ý |
| User Content → **Customer Support** | App Functionality | nội dung góp ý |
| User Content → **Other User Content** | App Functionality | chữ các câu trong *Đàm thoại với AI* và đoạn văn trong *Luyện viết với AI* (lưu theo tài khoản, gửi tới dịch vụ AI để trả lời / chấm bài) |
| Identifiers → **User ID** | App Functionality | mã tài khoản (kèm báo lỗi Sentry) |
| Usage Data → **Product Interaction** | App Functionality | tiến độ học, ngày học |
| Diagnostics → **Crash Data** | App Functionality | Sentry |

Không chọn: Location, Contacts, Browsing History, Purchases, Financial Info, Health, Advertising Data, Device ID (mã nhận thông báo không tính là Device ID).

*[AdMob]* Bản có quảng cáo: thêm phần Google AdMob thu thập, theo [hướng dẫn của Google cho App Privacy](https://developers.google.com/admob/ios/privacy/data-disclosure). Các mục dưới: *Linked to user = No*, mục đích **Third-Party Advertising** (kèm *Analytics* nếu Apple hỏi); **Used for tracking = Yes** cho *Device ID* và *Advertising Data* (IDFA chỉ có khi người dùng cho phép ATT).

| Loại dữ liệu (Apple) | Ghi chú |
|---|---|
| Location → **Coarse Location** | Google đoán vị trí gần đúng từ địa chỉ IP |
| Identifiers → **Device ID** | mã quảng cáo IDFA (khi cho phép theo dõi) |
| Usage Data → **Product Interaction**, **Advertising Data** | lượt xem / chạm quảng cáo |
| Diagnostics → **Crash Data**, **Performance Data**, **Other Diagnostic Data** | SDK quảng cáo |

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
- **Quảng cáo**: *Không, ứng dụng không chứa quảng cáo*. *[AdMob]* Bản có quảng cáo: **Có, ứng dụng chứa quảng cáo** (Google Play hiện nhãn *Chứa quảng cáo*).
- *[AdMob]* **Mã nhận dạng quảng cáo (Advertising ID)**: *Có*, dùng cho **Quảng cáo hoặc tiếp thị** (SDK AdMob khai quyền `AD_ID`). Bản trước AdMob trả lời *Không*.
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

- *Thu thập hoặc chia sẻ dữ liệu bắt buộc?* **Có**. *Mã hoá khi truyền*: **Có**. *Người dùng yêu cầu xoá được*: **Có**. *Chia sẻ với bên thứ ba*: **Không** (Azure, Resend, Expo, Sentry, dịch vụ AI của Đàm thoại và Luyện viết là nhà cung cấp dịch vụ xử lý thay 4UME, Google không tính là chia sẻ).

| Loại dữ liệu (Google) | Bắt buộc / tuỳ chọn | Mục đích | Ghi chú |
|---|---|---|---|
| Thông tin cá nhân → **Email** | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản | |
| Thông tin cá nhân → **Tên** | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản | |
| Thông tin cá nhân → **Mã nhận dạng người dùng** | Bắt buộc | Chức năng ứng dụng, Phân tích sự cố | |
| Âm thanh → **Bản ghi giọng nói** | Tuỳ chọn | Chức năng ứng dụng | *Xử lý tạm thời* = Có |
| Ảnh và video → **Ảnh** | Tuỳ chọn | Hỗ trợ khách hàng | ảnh đính kèm góp ý |
| Hoạt động trong ứng dụng → **Tương tác trong ứng dụng** | Bắt buộc | Chức năng ứng dụng | tiến độ học |
| Hoạt động trong ứng dụng → **Lịch sử tìm kiếm trong ứng dụng** | Tuỳ chọn | Chức năng ứng dụng | ô tra từ; *Xử lý tạm thời* = Có |
| Hoạt động trong ứng dụng → **Nội dung khác do người dùng tạo** | Tuỳ chọn | Hỗ trợ khách hàng, Chức năng ứng dụng | nội dung góp ý; chữ các câu trong *Đàm thoại với AI*; đoạn văn trong *Luyện viết với AI* |
| Thông tin và hiệu suất ứng dụng → **Nhật ký sự cố**, **Chẩn đoán** | Bắt buộc | Phân tích sự cố | Sentry |
| Mã thiết bị hoặc mã khác → **Mã thiết bị hoặc mã khác** | Tuỳ chọn | Chức năng ứng dụng | mã nhận thông báo |

*[AdMob]* Bản có quảng cáo: *Chia sẻ với bên thứ ba* đổi thành **Có** (Google AdMob), và thêm theo [hướng dẫn Data safety của Google cho AdMob](https://developers.google.com/admob/android/privacy/play-data-disclosure):

| Loại dữ liệu (Google) | Thu thập / chia sẻ | Mục đích | Ghi chú |
|---|---|---|---|
| Vị trí → **Vị trí gần đúng** | Cả hai | Quảng cáo hoặc tiếp thị, Phân tích, Chống gian lận | từ địa chỉ IP |
| Hoạt động trong ứng dụng → **Tương tác trong ứng dụng** | Cả hai | Quảng cáo hoặc tiếp thị, Phân tích | lượt xem / chạm quảng cáo |
| Thông tin và hiệu suất ứng dụng → **Nhật ký sự cố**, **Chẩn đoán** | Cả hai | Phân tích, Chống gian lận | SDK quảng cáo |
| Mã thiết bị hoặc mã khác → **Mã thiết bị hoặc mã khác** | Cả hai | Quảng cáo hoặc tiếp thị, Phân tích, Chống gian lận | mã quảng cáo (Advertising ID) |

### Thử nghiệm kín (Closed testing)

Tài khoản cá nhân: cần **ít nhất 12 người thử, tham gia liên tục 14 ngày** rồi mới xin *Quyền truy cập phiên bản chính thức*. Người thử cần điện thoại Android và Gmail.

1. *Kiểm thử → Thử nghiệm kín* → tạo kênh, thêm danh sách email người thử (hoặc một Google Group).
2. Tải `.aab` (bản build `production`) lên kênh → gửi xét duyệt.
3. Duyệt xong, gửi **link tham gia** cho người thử: họ bấm *Tham gia*, rồi cài từ Google Play.
4. Đủ 14 ngày (đếm từ khi có đủ 12 người đã tham gia) → *Bảng điều khiển → Đăng ký phiên bản chính thức*, trả lời vài câu hỏi về đợt thử.

## Ảnh

- **iPhone 6,9"** (1320×2868) bắt buộc; 6,5" tuỳ chọn (Apple tự thu nhỏ từ 6,9"). 3–10 ảnh.
- **Android điện thoại**: 2–8 ảnh, tỉ lệ 9:16; **ảnh nổi bật** 1024×500.
- Gợi ý thứ tự (7 ảnh): Trang chủ → thẻ từ vựng → chấm phát âm → bài nghe → ngữ pháp → **tab Luyện** → tổng kết tuần. Nguồn: `store/raw/01.png` … (gitignore) + `store/.venv/bin/python store/make_assets.py`.
- **Upload App Store Connect:** ô *iPhone 6.1" / Dynamic Island (medium)* → **`store/ios/screenshots-6.1-connect/`** (1179×2556). Ô 6,9" → `store/ios/screenshots-6.9/` (1290×2796). Chụp bằng tài khoản demo, không lộ email thật.
