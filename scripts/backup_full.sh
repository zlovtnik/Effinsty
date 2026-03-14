#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./oracle_backup_common.sh
source "${SCRIPT_DIR}/oracle_backup_common.sh"

TARGET_CONNECT=${TARGET_CONNECT:-/}

init_oracle_env
require_backup_dir
require_wallet_open

LOCK_FILE="/tmp/effinsty_backup_full_${ORACLE_SID}.lock"
LOG_DIR="/oracle/ops/logs/${ORACLE_SID}/rman"
MANIFEST_DIR="/oracle/ops/manifests/${ORACLE_SID}"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
CONTROLFILE_AUTOBACKUP_FORMAT="${MANIFEST_DIR}/cf_${TIMESTAMP}_%d_%U.ctl"
FULL_RMAN_CMD=$(mktemp "${TMPDIR:-/tmp}/backup_full.XXXXXX")
VERIFY_RMAN_CMD=$(mktemp "${TMPDIR:-/tmp}/backup_full_verify.XXXXXX")

cleanup() {
  rm -f "${FULL_RMAN_CMD}" "${VERIFY_RMAN_CMD}"
}

trap cleanup EXIT

mkdir -p "${LOG_DIR}" "${MANIFEST_DIR}"
export NLS_LANG="AMERICAN_AMERICA.UTF8"

printf "RUN {\n  CONFIGURE CONTROLFILE AUTOBACKUP FORMAT FOR DEVICE TYPE DISK TO '%s';\n  BACKUP AS COMPRESSED BACKUPSET DATABASE PLUS ARCHIVELOG TAG 'EFFIC_FULL';\n  BACKUP CURRENT CONTROLFILE TAG 'EFFIC_CONTROLFILE';\n  BACKUP SPFILE;\n}\nEXIT;\n" "${CONTROLFILE_AUTOBACKUP_FORMAT}" > "${FULL_RMAN_CMD}"
printf "LIST BACKUP SUMMARY;\nEXIT;\n" > "${VERIFY_RMAN_CMD}"

{
  flock -n 9 || { echo "Full backup already running" >&2; exit 1; }

  rman target "${TARGET_CONNECT}" cmdfile "${FULL_RMAN_CMD}" >"${LOG_DIR}/full-${TIMESTAMP}.log" 2>&1

  rman target "${TARGET_CONNECT}" cmdfile "${VERIFY_RMAN_CMD}" >>"${LOG_DIR}/full-${TIMESTAMP}.log" 2>&1

  shopt -s nullglob
  manifest_files=("${MANIFEST_DIR}/cf_${TIMESTAMP}_"*.ctl)
  if (( ${#manifest_files[@]} > 0 )); then
    sha256sum "${manifest_files[@]}" > "${MANIFEST_DIR}/backup-full-${TIMESTAMP}.sha256"
  else
    echo "Warning: no manifest files found for ${TIMESTAMP}" >&2
  fi
  shopt -u nullglob
} 9>"${LOCK_FILE}"

echo "full backup complete: ${LOG_DIR}/full-${TIMESTAMP}.log"
