#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCHEMA_FILE="${ROOT_DIR}/database/schema.sql"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:9124@localhost:5432/rtls}"

if ! command -v psql >/dev/null 2>&1; then
  echo "required command not found: psql" >&2
  exit 1
fi

if [[ ! -f "${SCHEMA_FILE}" ]]; then
  echo "missing schema file: ${SCHEMA_FILE}" >&2
  exit 1
fi

echo "Applying schema to ${DATABASE_URL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_FILE}"
