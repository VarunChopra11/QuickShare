#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Verify backend virtualenv
if [ ! -d "$REPO_DIR/backend/.venv" ]; then
    echo "Error: backend/.venv not found. Run ./scripts/install.sh first."
    exit 1
fi

# Build frontend if dist doesn't exist
if [ ! -d "$REPO_DIR/frontend/dist" ]; then
    echo "==> Production frontend build not detected. Building now..."
    "$REPO_DIR/scripts/build.sh"
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo "==> Starting QuickShare Production Server on http://$HOST:$PORT..."
cd "$REPO_DIR/backend"
exec ./.venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT" --workers 1
