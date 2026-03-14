#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./oracle_backup_common.sh
source "${SCRIPT_DIR}/oracle_backup_common.sh"

TARGET_CONNECT=${TARGET_CONNECT:-/}
AUXILIARY_CONNECT=${AUXILIARY_CONNECT:?missing AUXILIARY_CONNECT}
TEST_ENV=${TEST_ENV:-DEV_RECOVERY}
REPORT_FILE=${REPORT_FILE:-/oracle/recovery_tests.log}

init_oracle_env
require_backup_dir
require_wallet_open

[[ "${TEST_ENV}" =~ ^[A-Za-z0-9_]+$ ]] || {
  echo "Invalid TEST_ENV: ${TEST_ENV}" >&2
  exit 1
}

latest_backup_file=""
latest_backup_mtime=0

while IFS= read -r -d '' candidate; do
  if mtime=$(stat -c '%Y' "${candidate}" 2>/dev/null); then
    :
  elif mtime=$(stat -f '%m' "${candidate}" 2>/dev/null); then
    :
  else
    echo "Warning: unable to determine mtime for backup piece ${candidate}; skipping" >&2
    continue
  fi

  if (( mtime > latest_backup_mtime )); then
    latest_backup_mtime=${mtime}
    latest_backup_file=${candidate}
  fi
done < <(find "${BACKUP_DIR}" -type f -name '*.bkp' -mtime -1 -print0 2>/dev/null)

if [[ -z "${latest_backup_file}" ]]; then
  echo "No recent backup piece found in ${BACKUP_DIR} within 24h" >&2
  exit 1
fi

echo "Testing recovery from backup directory: ${BACKUP_DIR}"
echo "Most recent backup piece: ${latest_backup_file}"
echo "Prerequisite: auxiliary instance ${TEST_ENV} must already exist, be started NOMOUNT, and use isolated file destinations or configured name conversion."

rman target "${TARGET_CONNECT}" auxiliary "${AUXILIARY_CONNECT}" <<RMAN_EOF
    DUPLICATE TARGET DATABASE TO ${TEST_ENV} BACKUP LOCATION '${BACKUP_DIR}';
RMAN_EOF

sql_output=$(mktemp "${TMPDIR:-/tmp}/soc1_recovery_test.XXXXXX")
cleanup() {
  rm -f "${sql_output}"
}
trap cleanup EXIT

if [[ "${AUXILIARY_CONNECT}" == "/" ]]; then
  sqlplus -s / as sysdba <<SQL_EOF > "${sql_output}"
WHENEVER SQLERROR EXIT SQL.SQLCODE;
WHENEVER OSERROR EXIT FAILURE;
SET HEAD OFF FEEDBACK OFF PAGESIZE 0 VERIFY OFF TRIMSPOOL ON;
SELECT 'USERS|' || COUNT(*) FROM ${TEST_ENV}.USERS;
SELECT 'CONTACTS|' || COUNT(*) FROM ${TEST_ENV}.CONTACTS;
SELECT 'AUDIT_RECORDS|' || COUNT(*) FROM ${TEST_ENV}.USERS_AUDIT_LOG;
SELECT 'ORPHAN_CONTACTS|' || COUNT(DISTINCT c.USER_ID)
    FROM ${TEST_ENV}.CONTACTS c
    WHERE NOT EXISTS (SELECT 1 FROM ${TEST_ENV}.USERS u WHERE u.ID = c.USER_ID);
EXIT;
SQL_EOF
else
  sqlplus -s "${AUXILIARY_CONNECT}" as sysdba <<SQL_EOF > "${sql_output}"
WHENEVER SQLERROR EXIT SQL.SQLCODE;
WHENEVER OSERROR EXIT FAILURE;
SET HEAD OFF FEEDBACK OFF PAGESIZE 0 VERIFY OFF TRIMSPOOL ON;
SELECT 'USERS|' || COUNT(*) FROM ${TEST_ENV}.USERS;
SELECT 'CONTACTS|' || COUNT(*) FROM ${TEST_ENV}.CONTACTS;
SELECT 'AUDIT_RECORDS|' || COUNT(*) FROM ${TEST_ENV}.USERS_AUDIT_LOG;
SELECT 'ORPHAN_CONTACTS|' || COUNT(DISTINCT c.USER_ID)
    FROM ${TEST_ENV}.CONTACTS c
    WHERE NOT EXISTS (SELECT 1 FROM ${TEST_ENV}.USERS u WHERE u.ID = c.USER_ID);
EXIT;
SQL_EOF
fi

cat "${sql_output}" | tee -a "${REPORT_FILE}"

orphan_count=$(
  awk -F'|' '
    $1 == "ORPHAN_CONTACTS" {
      value = $2
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      print value
    }
  ' "${sql_output}" | tail -n 1
)

if [[ -z "${orphan_count}" ]]; then
  echo "Recovery Test: FAILED - unable to parse ORPHAN_CONTACTS metric" | tee -a "${REPORT_FILE}" >&2
  exit 1
fi

if [[ ! "${orphan_count}" =~ ^[0-9]+$ ]]; then
  echo "Recovery Test: FAILED - non-numeric ORPHAN_CONTACTS metric (${orphan_count})" | tee -a "${REPORT_FILE}" >&2
  exit 1
fi

if (( orphan_count > 0 )); then
  echo "Recovery Test: FAILED - orphan records detected (${orphan_count})" | tee -a "${REPORT_FILE}" >&2
  exit 1
fi

echo "Recovery Test: PASSED" | tee -a "${REPORT_FILE}"
