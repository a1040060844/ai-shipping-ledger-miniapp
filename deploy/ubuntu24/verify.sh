#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${DOMAIN:-}"
API_PREFIX="${API_PREFIX:-/shipping-ledger-api}"
FAIL=0

check_service() {
  local unit="$1"
  if systemctl is-active --quiet "$unit"; then
    echo "[OK] $unit"
  else
    echo "[FAIL] $unit" >&2
    FAIL=1
  fi
}

check_url() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 15 "$url" >/dev/null; then
    echo "[OK] $label -> $url"
  else
    echo "[FAIL] $label -> $url" >&2
    FAIL=1
  fi
}

check_service postgresql
check_service minio-shipping-ledger
check_service ai-shipping-ledger
check_service nginx

check_url "MinIO readiness" "http://127.0.0.1:9000/minio/health/ready"
check_url "API local health" "http://127.0.0.1:3000/health"

if [[ -n "$DOMAIN" ]]; then
  check_url "API public HTTPS health" "https://${DOMAIN}${API_PREFIX}/health"
else
  echo "[WARN] DOMAIN is not set; skipping public HTTPS check."
fi

if ss -lnt | grep -Eq '0\.0\.0\.0:(3000|5432|9000|9001)|\[::\]:(3000|5432|9000|9001)'; then
  echo "[FAIL] A private service port is listening on all interfaces." >&2
  ss -lnt | grep -E ':(3000|5432|9000|9001)' >&2 || true
  FAIL=1
else
  echo "[OK] API/PostgreSQL/MinIO private ports are not exposed on all interfaces"
fi

if nginx -t >/dev/null 2>&1; then
  echo "[OK] nginx configuration"
else
  echo "[FAIL] nginx configuration" >&2
  FAIL=1
fi

if systemctl is-enabled --quiet ai-shipping-ledger-backup.timer; then
  echo "[OK] daily backup timer enabled"
else
  echo "[FAIL] daily backup timer not enabled" >&2
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Deployment verification failed." >&2
  exit 1
fi

echo "Deployment verification passed."
