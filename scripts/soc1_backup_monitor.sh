#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./oracle_backup_common.sh
source "${SCRIPT_DIR}/oracle_backup_common.sh"

TARGET_CONNECT=${TARGET_CONNECT:-/}

init_oracle_env

umask 077
LOG_DIR="/oracle/ops/evidence/${ORACLE_SID}/monitoring"
REPORT_FILE="${LOG_DIR}/backup-monitor-$(date -u +%Y%m%dT%H%M%SZ).log"

mkdir -p "${LOG_DIR}"
chmod 700 "${LOG_DIR}"
: > "${REPORT_FILE}"
chmod 600 "${REPORT_FILE}"

rman_rc=0
if rman target "${TARGET_CONNECT}" <<'RMAN_EOF' >"${REPORT_FILE}" 2>&1
list backup summary;
list failure;
exit;
RMAN_EOF
then
  :
else
  rman_rc=$?
  printf 'RMAN_MONITOR_ERROR|%s\n' "${rman_rc}" >> "${REPORT_FILE}"
fi

sql_rc=0
if sqlplus -s / as sysdba "@${SCRIPT_DIR}/soc1_monitoring_check.sql" >> "${REPORT_FILE}" 2>&1; then
  :
else
  sql_rc=$?
  printf 'SQLPLUS_MONITOR_ERROR|%s\n' "${sql_rc}" >> "${REPORT_FILE}"
fi

monitor_failed=0
if grep -q "BACKUP_RETRY_NEEDED|1" "${REPORT_FILE}" || \
   grep -q "FAILED_LOGIN_BY_HOST" "${REPORT_FILE}" || \
   grep -q "FAILED_LOGIN_TOTAL" "${REPORT_FILE}"; then
  monitor_failed=1
fi

if (( rman_rc != 0 )); then
  echo "CRITICAL: RMAN monitoring command failed (rc=${rman_rc})" >&2
fi

if (( sql_rc != 0 )); then
  echo "CRITICAL: SQL monitoring query failed (rc=${sql_rc})" >&2
fi

if (( monitor_failed != 0 )); then
  echo "CRITICAL: monitoring check failed" >&2
fi

if (( rman_rc != 0 || sql_rc != 0 || monitor_failed != 0 )); then
  exit 1
fi
