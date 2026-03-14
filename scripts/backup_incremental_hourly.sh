#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./oracle_backup_common.sh
source "${SCRIPT_DIR}/oracle_backup_common.sh"

TARGET_CONNECT=${TARGET_CONNECT:-/}

init_oracle_env
require_backup_dir
require_wallet_open

LOG_DIR="/oracle/ops/logs/${ORACLE_SID}/rman"
LOCK_FILE="/tmp/effinsty_backup_inc.lock"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "${LOG_DIR}"

{
  flock -n 9 || { echo "Incremental backup already running" >&2; exit 1; }

  rman target "${TARGET_CONNECT}" <<'RMAN_EOF' >"${LOG_DIR}/incremental-${TIMESTAMP}.log" 2>&1
RUN {
  BACKUP AS COMPRESSED BACKUPSET INCREMENTAL LEVEL 1 DATABASE TAG 'EFFIC_INC_HOURLY';
  BACKUP ARCHIVELOG ALL NOT BACKED UP 1 TIMES;
}
RMAN_EOF
} 9>"${LOCK_FILE}"

echo "incremental backup complete: ${LOG_DIR}/incremental-${TIMESTAMP}.log"
