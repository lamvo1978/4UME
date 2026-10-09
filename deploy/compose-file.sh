# Sourced by backup.sh / restore.sh: picks the production compose file unless COMPOSE_FILE is set.
# The shared-VPS setup (deploy/vps) wins when its .env exists.
if [ -z "${COMPOSE_FILE:-}" ]; then
  if [ -f deploy/vps/.env ]; then
    COMPOSE_FILE=deploy/vps/docker-compose.yml
  else
    COMPOSE_FILE=docker-compose.prod.yml
  fi
fi
export COMPOSE_FILE
