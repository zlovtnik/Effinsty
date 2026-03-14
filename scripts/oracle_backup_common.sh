#!/usr/bin/env bash

if [[ -n "${EFFINSTY_ORACLE_BACKUP_COMMON_SOURCED:-}" ]]; then
  return 0
fi

readonly EFFINSTY_ORACLE_BACKUP_COMMON_SOURCED=1

require_safe_oracle_sid() {
  ORACLE_SID=${ORACLE_SID:?missing ORACLE_SID}
  [[ "${ORACLE_SID}" =~ ^[A-Za-z0-9_]+$ ]] || {
    echo "Invalid ORACLE_SID: ${ORACLE_SID}" >&2
    exit 1
  }
  export ORACLE_SID
}

init_oracle_env() {
  local oraenv_path=""

  require_safe_oracle_sid

  if [[ -x /usr/local/bin/oraenv ]]; then
    oraenv_path=/usr/local/bin/oraenv
  elif command -v oraenv >/dev/null 2>&1; then
    oraenv_path=$(command -v oraenv)
  fi

  if [[ -n "${oraenv_path}" ]]; then
    export ORAENV_ASK=NO
    # shellcheck disable=SC1090
    . "${oraenv_path}" -s >/dev/null 2>&1 || true
  fi

  ORACLE_HOME=${ORACLE_HOME:-}
  [[ -n "${ORACLE_HOME}" ]] || {
    echo "Missing ORACLE_HOME. Set ORACLE_HOME or install/configure oraenv." >&2
    exit 1
  }

  export ORACLE_HOME

  case ":${PATH}:" in
    *":${ORACLE_HOME}/bin:"*) ;;
    *) export PATH="${ORACLE_HOME}/bin:${PATH}" ;;
  esac

  export LD_LIBRARY_PATH="${ORACLE_HOME}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
}

require_directory_writable() {
  local directory=$1

  [[ -d "${directory}" ]] || {
    echo "Directory does not exist: ${directory}" >&2
    exit 1
  }

  [[ -w "${directory}" ]] || {
    echo "Directory is not writable by $(id -un): ${directory}" >&2
    exit 1
  }
}

require_render_safe_backup_dir() {
  local directory=$1

  [[ "${directory}" != *"'"* ]] || {
    echo "BACKUP_DIR cannot contain single quotes: ${directory}" >&2
    exit 1
  }

  [[ "${directory}" != *$'\n'* && "${directory}" != *$'\r'* ]] || {
    echo "BACKUP_DIR cannot contain newline characters: ${directory}" >&2
    exit 1
  }
}

require_backup_dir() {
  BACKUP_DIR=${BACKUP_DIR:?missing BACKUP_DIR}
  export BACKUP_DIR
  require_directory_writable "${BACKUP_DIR}"
  require_render_safe_backup_dir "${BACKUP_DIR}"
}

require_wallet_open() {
  local wallet_status
  local sqlplus_output
  local sqlplus_rc=0

  sqlplus_output=$(mktemp "${TMPDIR:-/tmp}/oracle_wallet_status.XXXXXX")

  if sqlplus -s / as sysdba >"${sqlplus_output}" 2>&1 <<'SQL'
SET HEADING OFF FEEDBACK OFF VERIFY OFF PAGESIZE 0 TRIMSPOOL ON;
WHENEVER SQLERROR EXIT SQL.SQLCODE;
WHENEVER OSERROR EXIT FAILURE;

SELECT CASE
         WHEN EXISTS (
           SELECT 1
           FROM v$encryption_wallet
           WHERE status = 'OPEN'
         ) THEN 'OPEN'
         ELSE 'CLOSED'
       END
FROM dual;
EXIT;
SQL
  then
    :
  else
    sqlplus_rc=$?
    echo "Failed to query Oracle wallet/TDE keystore status." >&2
    cat "${sqlplus_output}" >&2
    rm -f "${sqlplus_output}"
    exit "${sqlplus_rc}"
  fi

  wallet_status=$(tr -d '[:space:]' <"${sqlplus_output}")
  rm -f "${sqlplus_output}"

  [[ "${wallet_status}" == "OPEN" ]] || {
    echo "Oracle wallet/TDE keystore is not open. Open the keystore before running encrypted RMAN operations." >&2
    exit 1
  }
}
