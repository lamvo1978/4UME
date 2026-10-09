#!/usr/bin/env bash
# Restores a backup made by deploy/backup.sh, replacing the current database and images.
#   deploy/restore.sh backups/20261009-101500
set -euo pipefail

cd "$(dirname "$0")/.."
source deploy/compose-file.sh
src="${1:?usage: deploy/restore.sh backups/<timestamp>}"
[ -f "$src/db.dump" ] || { echo "Missing $src/db.dump" >&2; exit 1; }

read -r -p "This replaces ALL data in the running stack with $src. Type 'restore' to continue: " answer
[ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }

docker compose stop api
docker compose exec -T postgres pg_restore -U fourume -d fourume --clean --if-exists --no-owner < "$src/db.dump"
if [ -f "$src/media.tar.gz" ]; then
  docker compose run --rm --no-deps -T --entrypoint sh api -c 'rm -rf /app/media/* && tar -xzf - -C /app/media' < "$src/media.tar.gz"
fi
docker compose start api
echo "Restored from $src"
