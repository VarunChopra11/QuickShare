#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$REPO_DIR/backend/.venv" ]; then
    echo "Error: backend/.venv not found."
    exit 1
fi

echo "==> Triggering QuickShare expiration cleanup..."
cd "$REPO_DIR/backend"
PYTHONPATH=. ./.venv/bin/python3 -m app.cleanup
