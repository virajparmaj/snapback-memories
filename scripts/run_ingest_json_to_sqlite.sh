#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${REPO_ROOT}/.venv/bin/python3"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

JSON_PATH="${SNAPBACK_JSON_PATH:-${REPO_ROOT}/mydata~1766859916254/json/memories_history.json}"
OUTPUT_ROOT="${SNAPBACK_OUTPUT_ROOT:-/tmp/snapback_work}"
EXPORT_ROOT="${SNAPBACK_EXPORT_ROOT:-}"
DOWNLOAD_MODE="${SNAPBACK_DOWNLOAD_MODE:-missing}"
TIMEOUT_SEC="${SNAPBACK_TIMEOUT_SEC:-120}"
DB_PATH="${SNAPBACK_DB_PATH:-}"
COOKIE_FILE="${SNAPBACK_COOKIE_FILE:-}"
FFMPEG_BIN="${SNAPBACK_FFMPEG_BIN:-ffmpeg}"
FFPROBE_BIN="${SNAPBACK_FFPROBE_BIN:-ffprobe}"

CMD=(
  "${PYTHON_BIN}"
  "${SCRIPT_DIR}/ingest_json_to_sqlite.py"
  --json "${JSON_PATH}"
  --output-root "${OUTPUT_ROOT}"
  --download-mode "${DOWNLOAD_MODE}"
  --timeout-sec "${TIMEOUT_SEC}"
  --ffmpeg-bin "${FFMPEG_BIN}"
  --ffprobe-bin "${FFPROBE_BIN}"
)

if [[ -n "${EXPORT_ROOT}" ]]; then
  CMD+=(--export-root "${EXPORT_ROOT}")
fi

if [[ -n "${DB_PATH}" ]]; then
  CMD+=(--db-path "${DB_PATH}")
fi

if [[ -n "${COOKIE_FILE}" ]]; then
  CMD+=(--cookie-file "${COOKIE_FILE}")
fi

CMD+=("$@")

echo "Running ingest pipeline..."
printf '  %q' "${CMD[@]}"
echo

exec "${CMD[@]}"
