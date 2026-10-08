#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
    echo ""
    echo "==> Shutting down QuickShare dev servers..."
    kill $(jobs -p) 2>/dev/null || true
    wait 2>/dev/null || true
    echo "==> All processes stopped."
}

trap cleanup SIGINT SIGTERM EXIT

echo "==> Starting QuickShare in Development Mode..."

# Check virtual environment
if [ ! -d "$REPO_DIR/backend/.venv" ]; then
    echo "Error: backend/.venv not found. Run ./scripts/install.sh first."
    exit 1
fi

# 1. Start Backend with reload
echo "--> Starting Backend on http://127.0.0.1:8000..."
cd "$REPO_DIR/backend"
PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# 2. Start Frontend Vite server
echo "--> Starting Frontend on http://localhost:5173..."
cd "$REPO_DIR/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo "==> Dev servers running:"
echo "    - Web App: http://localhost:5173"
echo "    - Backend API: http://127.0.0.1:8000"
echo "    - API Docs: http://127.0.0.1:8000/docs"
echo "    (Press Ctrl+C to terminate both servers)"

wait $BACKEND_PID $FRONTEND_PID
