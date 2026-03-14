#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./oracle_backup_common.sh
source "${SCRIPT_DIR}/oracle_backup_common.sh"

TARGET_CONNECT=${TARGET_CONNECT:-/}
POLICY_SOURCE="${SCRIPT_DIR}/soc1_rman_policy.rman"
RENDERED_POLICY=$(mktemp "${TMPDIR:-/tmp}/soc1_rman_policy.XXXXXX")

cleanup() {
  rm -f "${RENDERED_POLICY}"
}

trap cleanup EXIT

init_oracle_env
require_backup_dir

policy_template=$(<"${POLICY_SOURCE}")
rendered_policy=${policy_template//__BACKUP_DIR__/${BACKUP_DIR}}

if [[ "${rendered_policy}" == *"__BACKUP_DIR__"* ]]; then
  echo "Failed to render RMAN policy: unresolved __BACKUP_DIR__ placeholder remains." >&2
  exit 1
fi

printf '%s' "${rendered_policy}" > "${RENDERED_POLICY}"

rman target "${TARGET_CONNECT}" cmdfile "${RENDERED_POLICY}"
