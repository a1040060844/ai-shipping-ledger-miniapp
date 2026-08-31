#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo -E $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_DIR="$REPO_ROOT/server"
TARGET_DIR="/opt/ai-shipping-ledger/server"
ENV_FILE="/etc/ai-shipping-ledger/server.env"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE. Run bootstrap.sh first." >&2; exit 1; }
[[ -f "$SOURCE_DIR/package.json" ]] || { echo "Run this script from a complete repository checkout." >&2; exit 1; }

install -d -m 0755 /opt/ai-shipping-ledger
install -d -m 0755 "$TARGET_DIR"

# Keep production secrets outside the repository. Only source code is synchronized.
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  "$SOURCE_DIR/" "$TARGET_DIR/"

chown -R shipping-ledger:shipping-ledger "$TARGET_DIR"

cd "$TARGET_DIR"

# Install/build as the service account. npm install is used until a package-lock is committed.
runuser -u shipping-ledger -- npm install
runuser -u shipping-ledger -- npx prisma generate
runuser -u shipping-ledger -- npm run build

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# First production baseline currently uses Prisma db push because the repository has no migration history yet.
# It is intentionally run without --accept-data-loss.
runuser -u shipping-ledger -- env DATABASE_URL="$DATABASE_URL" npx prisma db push

systemctl daemon-reload
systemctl enable ai-shipping-ledger.service
systemctl restart ai-shipping-ledger.service

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null; then
    echo "API deployment healthy: http://127.0.0.1:3000/health"
    exit 0
  fi
  sleep 1
done

echo "API failed health check. Recent logs:" >&2
journalctl -u ai-shipping-ledger.service -n 80 --no-pager >&2 || true
exit 1
