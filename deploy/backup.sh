#!/usr/bin/env bash
# Backs up the database and uploaded images into backups/<timestamp>/ and keeps the last KEEP backups.
#   deploy/backup.sh                                  # production stack (deploy/vps if set up, else docker-compose.prod.yml)
#   COMPOSE_FILE=docker-compose.yml deploy/backup.sh  # local dev stack, e.g. to move data to the VPS
set -euo pipefail

cd "$(dirname "$0")/.."
source deploy/compose-file.sh
KEEP="${KEEP:-14}"
dest="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dest"

docker compose exec -T postgres pg_dump -U fourume -d fourume --format=custom --no-owner > "$dest/db.dump"
docker compose exec -T api tar -czf - -C /app/media . > "$dest/media.tar.gz"

echo "Saved $dest ($(du -sh "$dest" | cut -f1))"
ls -1d backups/*/ | sort -r | tail -n +"$((KEEP + 1))" | while read -r old; do rm -rf "$old"; done
