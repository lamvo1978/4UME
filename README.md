# 4UME

App học tiếng Anh cho người Việt: flashcard (~3.308 từ A1–B2), ngữ pháp căn bản, bài tập; tài khoản và tiến trình lưu trên PostgreSQL.

Đường dẫn máy cá nhân dự kiến: `/Users/lamvhx/Projects/4UME`.

## Stack

- API: .NET 9 (Clean Architecture)
- Mobile: React Native (Expo, TypeScript)
- DB: PostgreSQL 16
- Docker Compose trên Linux

Chi tiết: [architecture.md](architecture.md) · UI: [docs/ui/DESIGN.md](docs/ui/DESIGN.md)

## Chạy bằng Docker

```bash
docker compose up -d --build
```

- API: http://127.0.0.1:5088  
- Swagger: http://127.0.0.1:5088/swagger  
- Postgres: `localhost:5432` · db/user/pass `fourume`

Trên một số môi trường agent, bridge Docker bị chặn: `docker-compose.yml` dùng `host.docker.internal` để API nối Postgres qua cổng host. Trên máy Mac/Linux bình thường bạn có thể đổi lại `Host=postgres` nếu muốn.

## Web admin

```bash
cd admin
npm install
npm run dev   # http://localhost:5173 (gọi API :5088 qua proxy)
```

Chi tiết: [docs/admin-web.md](docs/admin-web.md)

## Triển khai lên VPS

- VPS dùng chung với PetHubPro (`api.4ume.io.vn`, `admin.4ume.io.vn`): image build trên GitHub Actions, `deploy/vps/` — [docs/deploy-vps.md](docs/deploy-vps.md) · việc còn lại (sao lưu, build app): [docs/todo-deploy.md](docs/todo-deploy.md)
- VPS trống: `docker-compose.prod.yml` + Caddy (HTTPS tự động) — [docs/deploy.md](docs/deploy.md)

## Mobile

```bash
cd mobile
npm install
# máy thật / simulator trỏ API:
# EXPO_PUBLIC_API_URL=http://<ip-máy>:5088 npx expo start
npx expo start
```

## Dev API không Docker

```bash
# Postgres đang chạy (compose chỉ postgres cũng được)
dotnet run --project backend/FourUme.Api
```

## Bộ từ vựng

Nguồn: [`backend/data/vocabulary.json`](backend/data/vocabulary.json). Rebuild từ TSV:

```bash
python3 backend/scripts/build_vocabulary.py
```
