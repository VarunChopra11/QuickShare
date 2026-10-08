#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "==> Setting up QuickShare in $REPO_DIR"

# 1. Setup Backend Python virtual environment
echo "--> Setting up Python virtual environment in backend/.venv..."
cd "$REPO_DIR/backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

# 2. Setup Frontend dependencies
echo "--> Installing frontend dependencies..."
cd "$REPO_DIR/frontend"
npm install

echo "==> Installation complete!"
echo "    - Run './scripts/dev.sh' to start development servers."
echo "    - Run './scripts/build.sh' to build frontend for production."
echo "    - Run './scripts/start.sh' to run the production server."
