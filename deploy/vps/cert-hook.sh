#!/bin/sh
# Certbot deploy hook: after 4ume.io.vn is issued or renewed, copy it to the
# edge nginx cert folder and reload nginx. Install with:
#   sudo install -m 755 deploy/vps/cert-hook.sh /usr/local/sbin/4ume-cert-hook
# and pass --deploy-hook /usr/local/sbin/4ume-cert-hook to certbot certonly.
set -eu

DOMAIN=4ume.io.vn
TARGET=/opt/pethubpro/certs/$DOMAIN

case "${RENEWED_LINEAGE:-}" in
  */$DOMAIN) ;;
  *) exit 0 ;;
esac

mkdir -p "$TARGET"
cp -L "$RENEWED_LINEAGE/fullchain.pem" "$RENEWED_LINEAGE/privkey.pem" "$TARGET/"
chmod 600 "$TARGET/privkey.pem"
docker exec pethubpro-edge-nginx nginx -t && docker exec pethubpro-edge-nginx nginx -s reload
