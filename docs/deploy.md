# Triển khai lên VPS

> **VPS hiện tại (dùng chung với PetHubPro, `4ume.io.vn`)**: làm theo [deploy-vps.md](deploy-vps.md).
> Tài liệu dưới đây dành cho một **VPS trống**, khi 4UME tự giữ cổng 80/443 bằng Caddy.

Một VPS Ubuntu chạy 3 container bằng `docker-compose.prod.yml`:

| Container | Việc |
|---|---|
| `caddy` | Nhận HTTPS (cổng 80/443), **tự xin và gia hạn chứng chỉ SSL** (Let's Encrypt). Phục vụ web admin và chuyển request tới API. |
| `api` | API .NET (không mở cổng ra ngoài, chỉ Caddy gọi được). Tự chạy migration và nạp dữ liệu khi khởi động. |
| `postgres` | Database (không mở cổng ra ngoài). |

Hai tên miền con trỏ về cùng VPS:

- `api.<tên miền>` → API cho app điện thoại (và ảnh `/media/…`).
- `admin.<tên miền>` → web admin; `/api` và `/media` trên tên miền này cũng chuyển tới API nên web admin không cần cấu hình gì thêm.

Dữ liệu nằm trong volume Docker: `pg_data` (database), `media` (ảnh upload), `caddy_data` (chứng chỉ SSL).

## Cần chuẩn bị

- VPS Ubuntu 22.04 / 24.04, **tối thiểu 2 GB RAM** (build API + web admin cần bộ nhớ; 1 GB thì thêm swap, xem dưới), 20 GB ổ đĩa.
- Tên miền, tạo 2 bản ghi DNS **A** trỏ về IP của VPS: `api` và `admin` (ví dụ `api.4ume.vn`, `admin.4ume.vn`). Đợi DNS cập nhật (kiểm tra: `ping api.4ume.vn` ra đúng IP) **trước** khi chạy, nếu không Caddy không xin được SSL.
- Mã nguồn đã được commit và push lên GitHub (VPS lấy code bằng `git clone`).

## Cài lần đầu

Đăng nhập VPS bằng SSH rồi chạy lần lượt.

**1. Tường lửa** — chỉ mở SSH, HTTP, HTTPS:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

**2. Docker:**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

**3. (VPS 1 GB RAM) thêm 2 GB swap:**

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**4. Lấy mã nguồn và cấu hình:**

```bash
git clone https://github.com/lamvo1978/4UME.git ~/4ume && cd ~/4ume
cp .env.example .env
openssl rand -hex 32   # chạy 2 lần, dán vào POSTGRES_PASSWORD và JWT_KEY
nano .env
```

Điền trong `.env`: `API_DOMAIN`, `ADMIN_DOMAIN`, `ACME_EMAIL` (email nhận thông báo SSL), `POSTGRES_PASSWORD`, `JWT_KEY`, và `ADMIN_INITIAL_PASSWORD` (mật khẩu tạm cho `admin@4ume.io.vn`).

> Giữ `.env` cẩn thận: mất `JWT_KEY` thì mọi người phải đăng nhập lại; mất `POSTGRES_PASSWORD` thì phải đặt lại mật khẩu database.

**5. Chạy** (lần đầu build mất 5–10 phút):

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f caddy api   # Ctrl+C để thoát
```

Thấy `certificate obtained successfully` (Caddy) và `Now listening` (API) là xong.

**6. Đăng nhập lần đầu:** mở `https://admin.<tên miền>`, đăng nhập `admin@4ume.io.vn` + mật khẩu tạm, **đổi mật khẩu** (nút chìa khoá cạnh tên). Sau đó xoá giá trị `ADMIN_INITIAL_PASSWORD` trong `.env` (tài khoản đã có thì dòng này không còn tác dụng, xoá cho gọn và an toàn).

## Chuyển dữ liệu từ máy cá nhân lên (tuỳ chọn)

Nếu muốn mang theo dữ liệu đang có trên máy (từ / bài ngữ pháp đã sửa, ảnh, tài khoản, tiến độ học) thay vì bắt đầu từ dữ liệu gốc:

```bash
# Trên máy cá nhân (stack dev đang chạy):
COMPOSE_FILE=docker-compose.yml deploy/backup.sh
scp -r backups/<thời-gian> <user>@<ip-vps>:~/4ume/backups/

# Trên VPS (stack đã chạy ít nhất một lần):
deploy/restore.sh backups/<thời-gian>
```

`restore.sh` **thay toàn bộ** dữ liệu trên VPS bằng bản sao lưu (phải gõ `restore` để xác nhận). Tài khoản `admin@4ume.io.vn` trên máy sẽ thay tài khoản tạo ở bước 6, dùng mật khẩu trên máy.

## Sao lưu

`deploy/backup.sh` lưu database + ảnh vào `backups/<thời-gian>/`, giữ 14 bản mới nhất. Chạy tự động mỗi đêm lúc 3 giờ:

```bash
crontab -e
# thêm dòng:
0 3 * * * cd ~/4ume && deploy/backup.sh >> backups/backup.log 2>&1
```

Nên định kỳ chép thư mục `backups/` ra ngoài VPS (máy cá nhân, Google Drive…) — VPS hỏng thì bản sao lưu nằm trên nó cũng mất.

Khôi phục: `deploy/restore.sh backups/<thời-gian>`.

## Cập nhật phiên bản mới

```bash
cd ~/4ume
deploy/backup.sh                                    # sao lưu trước cho chắc
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migration database chạy tự động khi API khởi động. Web admin đang mở trong trình duyệt cần tải lại trang.

## App điện thoại

App trỏ tới API qua biến `EXPO_PUBLIC_API_URL` lúc build:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://api.<tên miền> npx expo start   # thử với Expo Go
```

Khi build bản phát hành (EAS) đặt cùng biến này trong cấu hình build. Ảnh upload từ admin hiển thị trên app qua `https://api.<tên miền>/media/…`.

## Lệnh hay dùng

```bash
alias dc='docker compose -f docker-compose.prod.yml'
dc ps                       # trạng thái
dc logs -f --tail=100 api   # log API
dc restart api              # khởi động lại API
dc exec postgres psql -U fourume -d fourume   # vào database
```

## Khác biệt so với chạy trên máy (`docker-compose.yml`)

| | Máy cá nhân | VPS |
|---|---|---|
| Môi trường | `Development` | `Production` |
| Swagger | Có (`/swagger`) | Tắt |
| Khoá JWT | Khoá mẫu | Bắt buộc khoá riêng ≥ 32 ký tự (API từ chối khởi động nếu dùng khoá mẫu) |
| Postgres | Mở cổng 5432, mật khẩu `fourume` | Không mở cổng, mật khẩu ngẫu nhiên |
| Web admin | `npm run dev` (:5173) | File tĩnh qua Caddy, HTTPS |
| Admin đầu tiên | `Admin__Emails` cấp quyền cho tài khoản có sẵn | `ADMIN_INITIAL_PASSWORD` tạo `admin@4ume.io.vn` |
