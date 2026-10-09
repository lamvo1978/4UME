# Triển khai lên VPS dùng chung với PetHubPro

4UME chạy cạnh PetHubPro trên cùng VPS (`ubuntu22`), **không đụng** tới container hay database của PetHubPro. Chỉ thêm một file cấu hình vào nginx sẵn có.

| | |
|---|---|
| Web admin | `https://admin.4ume.io.vn` |
| API cho app | `https://api.4ume.io.vn` |
| Thư mục trên VPS | `/opt/4ume` (mã nguồn, chỉ dùng phần `deploy/`) |
| Email gửi mã | Resend, `noreply@4ume.io.vn` — [email.md](email.md) |
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

### 1. DNS (Cloudflare)

Tên miền `4ume.io.vn` quản lý DNS trên Cloudflare. Trong **DNS → Records**, tạo 2 bản ghi:

| Type | Name | Content | Proxy status |
|---|---|---|---|
| A | `api` | IP của VPS | **DNS only** (mây xám) |
| A | `admin` | IP của VPS | **DNS only** (mây xám) |

Để mây xám: SSL do nginx trên VPS lo, đơn giản và không bị Cloudflare giới hạn upload / timeout. Kiểm tra: `ping api.4ume.io.vn` ra đúng IP.

### 2. Lấy mã nguồn và cấu hình

```bash
sudo mkdir -p /opt/4ume && sudo chown $USER: /opt/4ume
git clone https://github.com/lamvo1978/4UME.git /opt/4ume
cd /opt/4ume/deploy/vps
cp .env.example .env
openssl rand -hex 32   # chạy 2 lần, dán vào POSTGRES_PASSWORD và JWT_KEY
nano .env              # điền thêm ADMIN_INITIAL_PASSWORD (mật khẩu tạm cho admin@4ume.io.vn)
chmod 600 .env
```

> Giữ `.env` cẩn thận (nên chép một bản ra ngoài): mất `JWT_KEY` thì mọi người phải đăng nhập lại; mất `POSTGRES_PASSWORD` thì phải đặt lại mật khẩu database.

Các biến tuỳ chọn khác trong `.env`:

| Biến | Dùng cho |
|---|---|
| `PIXABAY_API_KEY`, `PEXELS_API_KEY` | Tìm ảnh trong admin ([admin-web.md](admin-web.md#4-hình-ảnh)) |
| `RESEND_API_KEY` | Gửi mã xác nhận đăng ký / quên mật khẩu. **Bắt buộc** nếu muốn người dùng tạo được tài khoản trên app ([email.md](email.md)) |
| `EMAIL_REPLY_TO` | Địa chỉ nhận thư khi người dùng bấm *Trả lời* thư mã |
| `IMAGE_TAG` | Chạy một bản cũ (`sha-<commit>`) thay vì `latest` |

Sửa `.env` xong chạy `docker compose up -d` để áp dụng.

### 3. Chứng chỉ SSL (tự gia hạn qua Cloudflare)

**Tạo API token**: Cloudflare → *My Profile → API Tokens → Create Token* → mẫu **Edit zone DNS** → *Zone Resources*: `Include – Specific zone – 4ume.io.vn` → tạo và chép token (chỉ hiện một lần).

Trên VPS, cài plugin Cloudflare cho certbot (chọn theo cách certbot đã được cài — xem `which certbot`: `/snap/bin/certbot` là snap, `/usr/bin/certbot` là apt):

```bash
# certbot cài bằng snap:
sudo snap set certbot trust-plugin-with-root=ok && sudo snap install certbot-dns-cloudflare
# certbot cài bằng apt:
sudo apt install -y python3-certbot-dns-cloudflare
```

Lưu token và cài hook chép chứng chỉ sang nginx:

```bash
sudo mkdir -p /root/.secrets
echo 'dns_cloudflare_api_token = <TOKEN>' | sudo tee /root/.secrets/cloudflare-4ume.ini >/dev/null
sudo chmod 600 /root/.secrets/cloudflare-4ume.ini
sudo install -m 755 /opt/4ume/deploy/vps/cert-hook.sh /usr/local/sbin/4ume-cert-hook
```

Xin chứng chỉ wildcard (certbot nhớ `--deploy-hook` cho các lần gia hạn sau):

```bash
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare-4ume.ini \
  --dns-cloudflare-propagation-seconds 30 \
  --deploy-hook /usr/local/sbin/4ume-cert-hook \
  -d '4ume.io.vn' -d '*.4ume.io.vn'
ls /opt/pethubpro/certs/4ume.io.vn/     # hook đã chép fullchain.pem, privkey.pem
```

Từ giờ certbot tự gia hạn (timer có sẵn của certbot), hook tự chép chứng chỉ mới và reload nginx. Thử: `sudo certbot renew --dry-run`.

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

Mở `https://admin.4ume.io.vn`, đăng nhập `admin@4ume.io.vn` + mật khẩu tạm, **đổi mật khẩu** (nút chìa khoá cạnh tên). Sau đó xoá giá trị `ADMIN_INITIAL_PASSWORD` trong `.env` (tài khoản đã có thì dòng này không còn tác dụng).

## Chuyển dữ liệu từ máy cá nhân lên (tuỳ chọn)

Mang theo từ / bài ngữ pháp đã sửa, ảnh, tài khoản, tiến độ học từ máy thay vì bắt đầu từ dữ liệu gốc:

```bash
# Trên máy cá nhân (stack dev đang chạy):
COMPOSE_FILE=docker-compose.yml deploy/backup.sh
scp -r backups/<thời-gian> lamvhx@<ip-vps>:/opt/4ume/backups/

# Trên VPS (4UME đã chạy ít nhất một lần):
cd /opt/4ume && deploy/restore.sh backups/<thời-gian>
```

`restore.sh` **thay toàn bộ** dữ liệu 4UME trên VPS (phải gõ `restore` để xác nhận). Tài khoản `admin@4ume.io.vn` trên máy sẽ thay tài khoản tạo ở bước 6.

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

Tự động (bước 3). Kiểm tra hạn: `sudo certbot certificates`; thử gia hạn: `sudo certbot renew --dry-run`. Nếu token Cloudflare bị xoá / hết hạn thì tạo token mới và ghi đè `/root/.secrets/cloudflare-4ume.ini`.

> Chứng chỉ PetHubPro hiện tại là `manual` (hết hạn 19/11/2026), **không** tự gia hạn. Nếu chuyển DNS `pethubpro.io.vn` sang Cloudflare thì làm tương tự để nó cũng tự gia hạn.

## App điện thoại

Build / chạy app trỏ tới API thật:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://api.4ume.io.vn npx expo start
```

Hoặc đặt sẵn `EXPO_PUBLIC_API_URL=https://api.4ume.io.vn` trong `mobile/.env.local` (git bỏ qua, đang có trên máy Mac) rồi chỉ cần `npx expo start --go -c`. Bản build EAS luôn trỏ API thật (`mobile/eas.json`). Đưa lên cửa hàng: [app-store.md](app-store.md).

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
