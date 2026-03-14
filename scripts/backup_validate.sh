#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./oracle_backup_common.sh
source "${SCRIPT_DIR}/oracle_backup_common.sh"

init_oracle_env

RUN_TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG_DIR="/oracle/ops/logs/${ORACLE_SID}/rman"
OUTFILE="${LOG_DIR}/validate-${RUN_TS}.txt"

mkdir -p "${LOG_DIR}"

sqlplus -s / as sysdba <<'SQL' > "${OUTFILE}"
SET HEADING OFF FEEDBACK OFF VERIFY OFF;
WHENEVER SQLERROR EXIT SQL.SQLCODE;
WHENEVER OSERROR EXIT FAILURE;

SELECT 'BACKUP_SET_COUNT|' || COUNT(*) FROM V$BACKUP_SET;
SELECT 'FULL_BACKUP_AGE_HOURS|' ||
       CASE
           WHEN MAX(COMPLETION_TIME) IS NULL THEN -1
           ELSE ROUND((SYSDATE - MAX(COMPLETION_TIME)) * 24, 2)
       END
FROM V$BACKUP_SET
WHERE INCREMENTAL_LEVEL = 0;
SELECT 'ARCHIVELOG_BACKUP_COUNT|' || COUNT(*)
FROM V$BACKUP_PIECE bp
JOIN V$BACKUP_SET bs
  ON bp.SET_STAMP = bs.SET_STAMP
 AND bp.SET_COUNT = bs.SET_COUNT
WHERE bs.BACKUP_TYPE = 'L';
EXIT;
SQL

AGE_HOURS=$(
  awk -F'|' '
    $1 == "FULL_BACKUP_AGE_HOURS" {
      value = $2
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      last = value
    }
    END {
      if (last != "") {
        print last
      }
    }
  ' "${OUTFILE}"
)

if [[ -z "${AGE_HOURS}" ]] || awk -v age="${AGE_HOURS}" '
  BEGIN {
    if (age ~ /^-?[0-9]+([.][0-9]+)?$/ && age >= 0 && age < 30) {
      exit 1
    }
    exit 0
  }
'; then
  echo "Critical: full backup age ${AGE_HOURS:-unknown} hours (threshold: 30)" >&2
  exit 1
fi

echo "validation complete: ${OUTFILE}"
