#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${REPO_ROOT}/.venv/bin/python3"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

OUTPUT_ROOT="${SNAPBACK_OUTPUT_ROOT:-/tmp/snapback_work}"
DB_PATH="${SNAPBACK_DB_PATH:-${OUTPUT_ROOT}/manifests/snapback.db}"
MEDIA_ROOT="${SNAPBACK_MEDIA_ROOT:-${OUTPUT_ROOT}/organized}"
API_PORT="${SNAPBACK_API_PORT:-5055}"

CMD=(
  "${PYTHON_BIN}"
  "${REPO_ROOT}/backend/server.py"
  --db "${DB_PATH}"
  --media "${MEDIA_ROOT}"
  --port "${API_PORT}"
)

CMD+=("$@")

echo "Starting backend..."
printf '  %q' "${CMD[@]}"
echo

exec "${CMD[@]}"
