#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$REPO_DIR/backend/.venv" ]; then
    echo "Error: backend/.venv not found. Run ./scripts/install.sh first."
    exit 1
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo "==> Starting QuickShare Backend on http://$HOST:$PORT..."
cd "$REPO_DIR/backend"
exec ./.venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT"
