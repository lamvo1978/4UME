# Triển khai lên VPS dùng chung với PetHubPro

4UME chạy cạnh PetHubPro trên cùng VPS (`ubuntu22`), **không đụng** tới container hay database của PetHubPro. Chỉ thêm một file cấu hình vào nginx sẵn có.

| | |
|---|---|
| Web admin | `https://admin.4ume.io.vn` |
| API cho app | `https://api.4ume.io.vn` |
| Thư mục trên VPS | `/opt/4ume` (mã nguồn, chỉ dùng phần `deploy/`) |
| Container | `fourume-postgres-1`, `fourume-api-1`, `fourume-admin-1` (project `fourume`) |

```
Internet ─▶ pethubpro-edge-nginx (80/443, SSL) ──┬─▶ PetHubPro (như cũ)
                                                  ├─▶ 4ume-api   :5088  ◀─ api.4ume.io.vn, admin.4ume.io.vn/api, /media
                                                  └─▶ 4ume-admin :80    ◀─ admin.4ume.io.vn
                                     4ume-api ─▶ fourume-postgres (mạng riêng, không ai khác thấy)
```

- **Image build sẵn trên GitHub**: mỗi lần push lên `main` (có sửa `backend/`, `admin/` hoặc file build), GitHub Actions ([`.github/workflows/images.yml`](../.github/workflows/images.yml)) build và đẩy `ghcr.io/lamvo1978/4ume-api` và `4ume-admin` (tag `latest` và `sha-<commit>`). VPS chỉ tải về, không build.
- **Postgres riêng** của 4UME, không mở cổng; dữ liệu trong volume `fourume_pg_data`, ảnh trong `fourume_media`.
- API và web admin nối vào mạng `pethubpro_net` với tên `4ume-api`, `4ume-admin` để nginx gọi được. nginx tra tên lúc có request, nên khi 4UME tắt thì PetHubPro vẫn chạy bình thường, chỉ hai tên miền 4UME báo 502.
- Tài nguyên: khoảng 300–400 MB RAM, image ~480 MB.

## Cài lần đầu

### 1. DNS

Tạo 2 bản ghi **A** trỏ về IP của VPS: `api.4ume.io.vn` và `admin.4ume.io.vn`. Kiểm tra: `ping api.4ume.io.vn` ra đúng IP.

### 2. Chứng chỉ SSL

Xin một chứng chỉ wildcard cho `4ume.io.vn` (giống cách đang làm cho PetHubPro — certbot `manual`, xác minh bằng bản ghi TXT):

```bash
sudo certbot certonly --manual --preferred-challenges dns -d '4ume.io.vn' -d '*.4ume.io.vn'
```

Certbot hiện 1–2 giá trị TXT cho `_acme-challenge.4ume.io.vn`: thêm vào DNS, đợi khoảng 1 phút rồi mới bấm Enter. Sau đó chép chứng chỉ sang thư mục nginx đọc:

```bash
sudo mkdir -p /opt/pethubpro/certs/4ume.io.vn
sudo cp -L /etc/letsencrypt/live/4ume.io.vn/fullchain.pem /etc/letsencrypt/live/4ume.io.vn/privkey.pem /opt/pethubpro/certs/4ume.io.vn/
```

> Chứng chỉ `manual` **không tự gia hạn** (hạn 90 ngày). Xem mục *Gia hạn SSL* bên dưới.

### 3. Lấy mã nguồn và cấu hình

```bash
sudo mkdir -p /opt/4ume && sudo chown $USER: /opt/4ume
git clone https://github.com/lamvo1978/4UME.git /opt/4ume
cd /opt/4ume/deploy/vps
cp .env.example .env
openssl rand -hex 32   # chạy 2 lần, dán vào POSTGRES_PASSWORD và JWT_KEY
nano .env              # điền thêm ADMIN_INITIAL_PASSWORD (mật khẩu tạm cho admin@4ume.com)
chmod 600 .env
```

> Giữ `.env` cẩn thận (nên chép một bản ra ngoài): mất `JWT_KEY` thì mọi người phải đăng nhập lại; mất `POSTGRES_PASSWORD` thì phải đặt lại mật khẩu database.

### 4. Chạy 4UME

```bash
cd /opt/4ume/deploy/vps
docker compose pull
docker compose up -d
docker compose logs -f api     # thấy "Now listening on" là xong; Ctrl+C để thoát
```

Nếu `pull` báo `denied`: đăng nhập GHCR một lần (`docker login ghcr.io -u lamvo1978`, mật khẩu là GitHub token có quyền `read:packages`), hoặc đặt 2 package `4ume-api`, `4ume-admin` thành Public trong GitHub → Packages.

### 5. Nối vào nginx

```bash
sudo cp /opt/4ume/deploy/vps/4ume.conf /opt/pethubpro/edge/nginx/4ume.conf
docker exec pethubpro-edge-nginx nginx -t && docker exec pethubpro-edge-nginx nginx -s reload
```

`nginx -t` kiểm tra cấu hình trước; nếu báo lỗi thì **không** reload (PetHubPro không bị ảnh hưởng) — gửi lỗi đó để xử lý.

### 6. Đăng nhập lần đầu

Mở `https://admin.4ume.io.vn`, đăng nhập `admin@4ume.com` + mật khẩu tạm, **đổi mật khẩu** (nút chìa khoá cạnh tên). Sau đó xoá giá trị `ADMIN_INITIAL_PASSWORD` trong `.env` (tài khoản đã có thì dòng này không còn tác dụng).

## Chuyển dữ liệu từ máy cá nhân lên (tuỳ chọn)

Mang theo từ / bài ngữ pháp đã sửa, ảnh, tài khoản, tiến độ học từ máy thay vì bắt đầu từ dữ liệu gốc:

```bash
# Trên máy cá nhân (stack dev đang chạy):
COMPOSE_FILE=docker-compose.yml deploy/backup.sh
scp -r backups/<thời-gian> lamvhx@<ip-vps>:/opt/4ume/backups/

# Trên VPS (4UME đã chạy ít nhất một lần):
cd /opt/4ume && deploy/restore.sh backups/<thời-gian>
```

`restore.sh` **thay toàn bộ** dữ liệu 4UME trên VPS (phải gõ `restore` để xác nhận). Tài khoản `admin@4ume.com` trên máy sẽ thay tài khoản tạo ở bước 6.

## Cập nhật phiên bản mới

1. Push code lên `main` → đợi GitHub Actions *Build images* xong (tab Actions trên GitHub, khoảng 3–5 phút).
2. Trên VPS:

```bash
cd /opt/4ume && git pull && deploy/backup.sh
cd deploy/vps && docker compose pull && docker compose up -d
docker image prune -f      # xoá image cũ cho đỡ tốn ổ
```

Migration database chạy tự động khi API khởi động. Nếu `4ume.conf` có thay đổi thì chép lại như bước 5.

**Quay lại bản cũ**: đặt `IMAGE_TAG=sha-<commit>` (xem tag trong GitHub → Packages) trong `.env`, chạy `docker compose up -d`. Bỏ dòng đó (hoặc `latest`) để về bản mới nhất.

## Sao lưu

`deploy/backup.sh` lưu database + ảnh vào `/opt/4ume/backups/<thời-gian>/`, giữ 14 bản mới nhất. Chạy tự động mỗi đêm lúc 3 giờ:

```bash
crontab -e
# thêm dòng:
0 3 * * * cd /opt/4ume && deploy/backup.sh >> backups/backup.log 2>&1
```

Nên định kỳ chép `backups/` ra ngoài VPS. Khôi phục: `deploy/restore.sh backups/<thời-gian>`.

## Gia hạn SSL

Chứng chỉ `manual` hết hạn sau 90 ngày (xem: `sudo certbot certificates`). Trước hạn khoảng 2 tuần:

```bash
sudo certbot certonly --manual --preferred-challenges dns -d '4ume.io.vn' -d '*.4ume.io.vn'
sudo cp -L /etc/letsencrypt/live/4ume.io.vn/fullchain.pem /etc/letsencrypt/live/4ume.io.vn/privkey.pem /opt/pethubpro/certs/4ume.io.vn/
docker exec pethubpro-edge-nginx nginx -t && docker exec pethubpro-edge-nginx nginx -s reload
```

> Chứng chỉ PetHubPro hiện tại cũng là `manual` (hết hạn 19/11/2026). Nếu DNS của tên miền nằm trên Cloudflare, có thể chuyển cả hai sang plugin `certbot-dns-cloudflare` để **tự gia hạn**, không phải làm tay nữa.

## App điện thoại

Build / chạy app trỏ tới API thật:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://api.4ume.io.vn npx expo start
```

## Lệnh hay dùng

```bash
cd /opt/4ume/deploy/vps
docker compose ps                       # trạng thái
docker compose logs -f --tail=100 api   # log API
docker compose restart api
docker compose exec postgres psql -U fourume -d fourume
```

## Gỡ 4UME khỏi VPS

```bash
sudo rm /opt/pethubpro/edge/nginx/4ume.conf
docker exec pethubpro-edge-nginx nginx -s reload
cd /opt/4ume/deploy/vps && docker compose down        # thêm -v để xoá luôn dữ liệu
```
