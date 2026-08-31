#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo -E $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
APP_USER="shipping-ledger"
APP_GROUP="shipping-ledger"
APP_ETC="/etc/ai-shipping-ledger"
APP_DATA="/var/lib/ai-shipping-ledger"
APP_BACKUP="/var/backups/ai-shipping-ledger"
DB_NAME="shipping_ledger"
DB_USER="shipping_ledger"
MINIO_USER="minio-shipping"
MINIO_GROUP="minio-shipping"
MINIO_BUCKET="shipping-ledger"

DASHSCOPE_API_KEY="${DASHSCOPE_API_KEY:-}"
DASHSCOPE_BASE_URL="${DASHSCOPE_BASE_URL:-}"
QWEN_MODEL="${QWEN_MODEL:-qwen3.8-flash}"

if [[ -z "$DASHSCOPE_API_KEY" || -z "$DASHSCOPE_BASE_URL" ]]; then
  echo "DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL must be exported before bootstrap." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg git rsync nginx postgresql postgresql-contrib certbot python3-certbot-nginx jq openssl

# Node.js 22 from NodeSource; do not replace a working Node 22 installation.
NODE_MAJOR="$(node -p 'process.versions.node.split(`.`)[0]' 2>/dev/null || true)"
if [[ "$NODE_MAJOR" != "22" ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repository.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  cat >/etc/apt/sources.list.d/nodesource.list <<'EOF'
deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main
EOF
  apt-get update
  apt-get install -y nodejs
fi

getent group "$APP_GROUP" >/dev/null || groupadd --system "$APP_GROUP"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --gid "$APP_GROUP" --create-home --home-dir /var/lib/${APP_USER} --shell /usr/sbin/nologin "$APP_USER"
getent group "$MINIO_GROUP" >/dev/null || groupadd --system "$MINIO_GROUP"
id "$MINIO_USER" >/dev/null 2>&1 || useradd --system --gid "$MINIO_GROUP" --home-dir "$APP_DATA/minio" --shell /usr/sbin/nologin "$MINIO_USER"

install -d -m 0750 -o root -g "$APP_GROUP" "$APP_ETC"
install -d -m 0750 -o "$MINIO_USER" -g "$MINIO_GROUP" "$APP_DATA/minio"
install -d -m 0750 -o root -g "$APP_GROUP" "$APP_BACKUP"
install -d -m 0755 /opt/ai-shipping-ledger

# Install MinIO server and client for the server architecture.
ARCH="$(dpkg --print-architecture)"
case "$ARCH" in
  amd64) MINIO_ARCH="amd64" ;;
  arm64) MINIO_ARCH="arm64" ;;
  *) echo "Unsupported architecture for MinIO bootstrap: $ARCH" >&2; exit 1 ;;
esac

curl -fsSL "https://dl.min.io/server/minio/release/linux-${MINIO_ARCH}/minio" -o /usr/local/bin/minio
curl -fsSL "https://dl.min.io/client/mc/release/linux-${MINIO_ARCH}/mc" -o /usr/local/bin/mc
chmod 0755 /usr/local/bin/minio /usr/local/bin/mc

DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 24)}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-shipping-$(openssl rand -hex 8)}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-$(openssl rand -hex 32)}"

# Local-only PostgreSQL role/database. Passwords are generated as hex so DATABASE_URL needs no URL escaping.
runuser -u postgres -- psql --set=ON_ERROR_STOP=1 --set=dbpass="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE shipping_ledger LOGIN PASSWORD %L', :'dbpass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shipping_ledger') \gexec
SELECT format('ALTER ROLE shipping_ledger PASSWORD %L', :'dbpass') \gexec
SQL

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  runuser -u postgres -- createdb -O "$DB_USER" "$DB_NAME"
fi

cat >"$APP_ETC/server.env" <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public
PORT=3000
HOST=127.0.0.1
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_BUCKET=${MINIO_BUCKET}
MAX_UPLOAD_BYTES=15728640
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
DASHSCOPE_BASE_URL=${DASHSCOPE_BASE_URL}
QWEN_MODEL=${QWEN_MODEL}
EOF
chmod 0640 "$APP_ETC/server.env"
chown root:"$APP_GROUP" "$APP_ETC/server.env"

cat >"$APP_ETC/minio.env" <<EOF
MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
EOF
chmod 0600 "$APP_ETC/minio.env"
chown root:root "$APP_ETC/minio.env"

install -m 0644 "$(dirname "$0")/systemd/minio-shipping-ledger.service" /etc/systemd/system/minio-shipping-ledger.service
install -m 0644 "$(dirname "$0")/systemd/ai-shipping-ledger.service" /etc/systemd/system/ai-shipping-ledger.service
install -m 0644 "$(dirname "$0")/systemd/ai-shipping-ledger-backup.service" /etc/systemd/system/ai-shipping-ledger-backup.service
install -m 0644 "$(dirname "$0")/systemd/ai-shipping-ledger-backup.timer" /etc/systemd/system/ai-shipping-ledger-backup.timer
install -m 0750 "$(dirname "$0")/backup.sh" /usr/local/sbin/ai-shipping-ledger-backup
install -m 0644 "$(dirname "$0")/nginx/location.conf" /etc/nginx/snippets/ai-shipping-ledger-location.conf

systemctl daemon-reload
systemctl enable --now postgresql
systemctl enable --now minio-shipping-ledger

# Wait for MinIO before creating the private bucket.
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:9000/minio/health/ready >/dev/null; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:9000/minio/health/ready >/dev/null || { echo "MinIO did not become ready." >&2; exit 1; }

mc alias set shipping-local http://127.0.0.1:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
mc mb --ignore-existing "shipping-local/${MINIO_BUCKET}" >/dev/null
mc anonymous set none "shipping-local/${MINIO_BUCKET}" >/dev/null
mc version enable "shipping-local/${MINIO_BUCKET}" >/dev/null || true

systemctl enable ai-shipping-ledger-backup.timer
systemctl start ai-shipping-ledger-backup.timer

cat <<EOF
Bootstrap complete.
Secrets: $APP_ETC/server.env (root:${APP_GROUP}, mode 0640)
MinIO: 127.0.0.1:9000 only
PostgreSQL DB: ${DB_NAME}, local only
Next: sudo -E ./deploy/ubuntu24/deploy-app.sh
EOF
