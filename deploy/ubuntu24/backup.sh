#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="/etc/ai-shipping-ledger/server.env"
BACKUP_ROOT="/var/backups/ai-shipping-ledger"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_DIR="$BACKUP_ROOT/postgres"
OBJECT_MIRROR="$BACKUP_ROOT/minio-current"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$DB_DIR" "$OBJECT_MIRROR"
chmod 0750 "$BACKUP_ROOT" "$DB_DIR" "$OBJECT_MIRROR"

# DATABASE_URL is local and its generated password is hex-only.
DB_PASS="$(printf '%s' "$DATABASE_URL" | sed -E 's#postgresql://[^:]+:([^@]+)@.*#\1#')"
DB_USER="$(printf '%s' "$DATABASE_URL" | sed -E 's#postgresql://([^:]+):.*#\1#')"
DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"

PGPASSWORD="$DB_PASS" pg_dump \
  --host=127.0.0.1 \
  --username="$DB_USER" \
  --format=custom \
  --no-owner \
  --file="$DB_DIR/shipping-ledger-${STAMP}.dump" \
  "$DB_NAME"

mc alias set shipping-backup http://127.0.0.1:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
mc mirror --overwrite "shipping-backup/${MINIO_BUCKET}" "$OBJECT_MIRROR" >/dev/null

find "$DB_DIR" -type f -name 'shipping-ledger-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "Backup completed: database snapshot + MinIO mirror"
