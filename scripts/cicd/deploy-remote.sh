#!/usr/bin/env bash
# Runs on the deploy server (dev/qa/prod). Uploaded by deploy.sh.
# Env vars expected:
#   ENV    - dev | qa | prod
#   IMAGE  - full TCR image with tag

set -euo pipefail

: "${ENV:?ENV must be set}"
: "${IMAGE:?IMAGE must be set}"

case "$ENV" in
  dev)
    CONTAINER="numind-admin-web-dev"
    PORTS="-p 9100:80"
    HEALTH_PORT=9100
    API_PROXY_PASS="http://numind-admin-server-dev:9099/"
    ;;
  qa)
    CONTAINER="numind-admin-web-qa"
    PORTS="-p 9101:80"
    HEALTH_PORT=9101
    API_PROXY_PASS="http://numind-admin-server-qa:9099/"
    ;;
  prod)
    CONTAINER="numind-admin-web-prod"
    PORTS="-p 9102:80"
    HEALTH_PORT=9102
    API_PROXY_PASS="http://numind-admin-server-prod:9099/"
    ;;
  *)
    echo "ERROR: ENV must be dev/qa/prod, got '$ENV'" >&2
    exit 1 ;;
esac

HEALTH_PATH="/health"
HEALTH_URL="http://localhost:${HEALTH_PORT}${HEALTH_PATH}"
LOG_MAX_SIZE="10m"; LOG_MAX_FILE="3"
[ "$ENV" = "prod" ] && { LOG_MAX_SIZE="20m"; LOG_MAX_FILE="5"; }

echo "==============================================="
echo "Deploy: $CONTAINER"
echo "  Image           : $IMAGE"
echo "  Env             : $ENV"
echo "  Health          : $HEALTH_URL"
echo "  API_PROXY_PASS  : $API_PROXY_PASS"
echo "==============================================="

OLD_IMAGE=""
if [ "$ENV" = "prod" ]; then
  OLD_IMAGE=$(docker inspect --format='{{.Config.Image}}' "$CONTAINER" 2>/dev/null || echo "")
  [ -n "$OLD_IMAGE" ] && echo "Previous image (for rollback): $OLD_IMAGE"
fi

echo "Pulling image..."
docker pull "$IMAGE" \
  || { echo "Pull retry 1/2..."; sleep 10; docker pull "$IMAGE"; } \
  || { echo "Pull retry 2/2..."; sleep 20; docker pull "$IMAGE"; }
docker image prune -f >/dev/null 2>&1 || true

docker network create numind-network 2>/dev/null || true

start_container() {
  local img="$1"
  docker run -d \
    --name "$CONTAINER" \
    --network numind-network \
    $PORTS \
    -e "APP_ENV=${ENV}" \
    -e "API_PROXY_PASS=${API_PROXY_PASS}" \
    --log-driver json-file \
    --log-opt "max-size=${LOG_MAX_SIZE}" \
    --log-opt "max-file=${LOG_MAX_FILE}" \
    --restart always \
    "$img"
}

docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true
start_container "$IMAGE"

# Frontend boots fast: nginx + envsubst, ~1-2s. 30s ceiling is plenty.
MAX_TRIES=15
SLEEP_INT=2

echo "Waiting for health check (up to $((MAX_TRIES * SLEEP_INT))s)..."
READY=false
for i in $(seq 1 "$MAX_TRIES"); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    READY=true; break
  fi
  sleep "$SLEEP_INT"
done

if [ "$READY" = true ]; then
  echo "✅ Deploy success: $CONTAINER is healthy"
  docker ps -f "name=^${CONTAINER}\$" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  exit 0
fi

echo "❌ Health check timeout for $CONTAINER" >&2
docker logs --tail 50 "$CONTAINER" || true

if [ "$ENV" = "prod" ] && [ -n "$OLD_IMAGE" ]; then
  echo "🔄 Rolling back to $OLD_IMAGE..."
  docker stop "$CONTAINER" 2>/dev/null || true
  docker rm "$CONTAINER" 2>/dev/null || true
  start_container "$OLD_IMAGE"
  for i in $(seq 1 "$MAX_TRIES"); do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      echo "⚠️  Rollback success: $OLD_IMAGE restored"
      exit 1
    fi
    sleep "$SLEEP_INT"
  done
  echo "❌ Rollback also failed" >&2
fi
exit 1
