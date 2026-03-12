#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bootstrap_fsharp_project.sh <project-name> [options]

Options:
  --template <console|webapi|classlib>  Project template (default: console)
  --no-tests                            Skip test project creation
  --dry-run                             Print commands without executing
  -h, --help                            Show this help

Examples:
  bootstrap_fsharp_project.sh MyApp
  bootstrap_fsharp_project.sh MyApi --template webapi
  bootstrap_fsharp_project.sh MyLibrary --template classlib --no-tests
EOF
}

PROJECT_NAME=""
TEMPLATE="console"
CREATE_TESTS=true
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --template)
      if [[ -n "${2:-}" && "${2:-}" != -* ]]; then
        TEMPLATE="$2"
        shift 2
      else
        echo "Error: --template requires a value (console|webapi|classlib)." >&2
        usage
        exit 1
      fi
      ;;
    --no-tests)
      CREATE_TESTS=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -z "$PROJECT_NAME" ]]; then
        PROJECT_NAME="$1"
      else
        echo "Unexpected extra argument: $1" >&2
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$PROJECT_NAME" ]]; then
  echo "Project name is required." >&2
  usage
  exit 1
fi

if [[ "$TEMPLATE" != "console" && "$TEMPLATE" != "webapi" && "$TEMPLATE" != "classlib" ]]; then
  echo "Invalid template '$TEMPLATE'. Use console, webapi, or classlib." >&2
  exit 1
fi

run_cmd() {
  if $DRY_RUN; then
    printf '[dry-run] %q' "$1"
    shift
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
  else
    "$@"
  fi
}

if ! $DRY_RUN; then
  if ! command -v dotnet >/dev/null 2>&1; then
    echo "dotnet SDK is required but was not found in PATH." >&2
    exit 1
  fi
fi

SOLUTION_FILE="${PROJECT_NAME}.sln"
APP_DIR="src/${PROJECT_NAME}"
TEST_PROJECT_NAME="${PROJECT_NAME}.Tests"
TEST_DIR="tests/${TEST_PROJECT_NAME}"

run_cmd mkdir -p src tests

if [[ ! -f "$SOLUTION_FILE" ]]; then
  run_cmd dotnet new sln -n "$PROJECT_NAME"
fi

run_cmd dotnet new "$TEMPLATE" -lang F# -n "$PROJECT_NAME" -o "$APP_DIR"
run_cmd dotnet sln "$SOLUTION_FILE" add "${APP_DIR}/${PROJECT_NAME}.fsproj"

if $CREATE_TESTS; then
  run_cmd dotnet new xunit -lang F# -n "$TEST_PROJECT_NAME" -o "$TEST_DIR"
  run_cmd dotnet sln "$SOLUTION_FILE" add "${TEST_DIR}/${TEST_PROJECT_NAME}.fsproj"
  run_cmd dotnet add "${TEST_DIR}/${TEST_PROJECT_NAME}.fsproj" reference "${APP_DIR}/${PROJECT_NAME}.fsproj"
fi

echo "F# project bootstrap complete for '${PROJECT_NAME}'."
