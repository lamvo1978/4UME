# 4UME

App học tiếng Anh cho người Việt: flashcard theo chủ đề (7.544 từ A1–B2, 27 bộ), 46 bài ngữ pháp có bài tập, ôn tập lặp lại ngắt quãng, chuỗi ngày học, nhắc học. Tài khoản và tiến trình lưu trên PostgreSQL; nội dung quản lý qua web admin.

Đường dẫn máy cá nhân: `/Users/lamvhx/Projects/4UME`.

## Đang chạy ở đâu

| | |
|---|---|
| API cho app | https://api.4ume.io.vn |
| Web admin | https://admin.4ume.io.vn |
| VPS | `ubuntu22`, dùng chung với PetHubPro — [docs/deploy-vps.md](docs/deploy-vps.md) |
| Email gửi mã | Resend, `noreply@4ume.io.vn` — [docs/email.md](docs/email.md) |
| Mã nguồn | https://github.com/lamvo1978/4UME (push `main` → GitHub Actions build image) |

Việc còn lại, nhật ký thay đổi: [docs/todo-deploy.md](docs/todo-deploy.md) · Đưa app lên cửa hàng: [docs/app-store.md](docs/app-store.md)

## Stack

- API: .NET 9 (Clean Architecture), EF Core + PostgreSQL 16
- Mobile: React Native (Expo SDK 57, TypeScript)
- Web admin: React + Vite + Mantine
- Docker Compose trên Linux

Chi tiết: [architecture.md](architecture.md) · UI: [docs/ui/DESIGN.md](docs/ui/DESIGN.md)

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [architecture.md](architecture.md) | Kiến trúc, bảng dữ liệu, API |
| [docs/admin-web.md](docs/admin-web.md) | Web admin: tính năng, phân quyền, API admin |
| [docs/email.md](docs/email.md) | Mã xác nhận đăng ký / quên mật khẩu, Resend, Zoho |
| [docs/notifications.md](docs/notifications.md) | Nhắc học, thông báo |
| [docs/grammar-lesson-schema.md](docs/grammar-lesson-schema.md) | Khung bài ngữ pháp |
| [docs/vocabulary-cefrj.md](docs/vocabulary-cefrj.md) | Nguồn từ vựng |
| [docs/deploy-vps.md](docs/deploy-vps.md) | Triển khai trên VPS hiện tại |
| [docs/deploy.md](docs/deploy.md) | Triển khai trên VPS trống (Caddy) |
| [docs/todo-deploy.md](docs/todo-deploy.md) | Trạng thái, việc còn lại, nhật ký thay đổi |
| [docs/app-store.md](docs/app-store.md) | Google Play / App Store |

## Chạy trên máy bằng Docker

```bash
docker compose up -d --build
```

- API: http://127.0.0.1:5088
- Swagger: http://127.0.0.1:5088/swagger
- Postgres: `localhost:5432` · db/user/pass `fourume`

Key tuỳ chọn để trong `.env` ở thư mục gốc (git bỏ qua, mẫu ở `.env.example`): `PIXABAY_API_KEY`, `PEXELS_API_KEY` (tìm ảnh), `RESEND_API_KEY` (gửi mã thật). Không có `RESEND_API_KEY` thì mã xác nhận chỉ in ra log:

```bash
docker compose logs api | grep "Mã của bạn"
```

Chỉ build lại API: `docker compose up -d --build api` (`dotnet build` trên máy có lúc treo; lỗi `mcr.microsoft.com … EOF` là lỗi mạng tạm thời, chạy lại).

Trên một số môi trường agent, bridge Docker bị chặn: `docker-compose.yml` dùng `host.docker.internal` để API nối Postgres qua cổng host. Trên máy Mac/Linux bình thường bạn có thể đổi lại `Host=postgres` nếu muốn.

## Web admin

```bash
cd admin
npm install
npm run dev   # http://localhost:5173 (gọi API :5088 qua proxy)
```

Chi tiết: [docs/admin-web.md](docs/admin-web.md)

## Mobile

```bash
cd mobile
npm install
npx expo start --go -c
```

- API mặc định là máy dev (`:5088`). Trỏ API thật: tạo `mobile/.env.local` với `EXPO_PUBLIC_API_URL=https://api.4ume.io.vn` (git bỏ qua), hoặc `EXPO_PUBLIC_API_URL=http://<ip-máy>:5088 npx expo start` để dùng API trên máy.
- iPhone: Expo Go và Mac phải đăng nhập cùng tài khoản Expo (`npx expo login`).
- Xem bản web: `npx expo start --web`.

## Dev API không Docker

```bash
# Postgres đang chạy (compose chỉ postgres cũng được)
dotnet run --project backend/FourUme.Api
```

Thêm migration (sau khi build được):

```bash
cd backend
dotnet ef migrations add <Tên> -p FourUme.Infrastructure -s FourUme.Api -o Persistence/Migrations
```

Migration tự chạy khi API khởi động.

## Bộ từ vựng

Nguồn nạp lần đầu: [`backend/data/vocabulary.json`](backend/data/vocabulary.json) (sau đó database là nguồn chính, sửa qua web admin). Rebuild từ TSV:

```bash
python3 backend/scripts/build_vocabulary.py
```
