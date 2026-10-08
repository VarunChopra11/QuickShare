#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building QuickShare Frontend..."
cd "$REPO_DIR/frontend"

npm run build

echo "==> Build successful! Distribution created at frontend/dist/"
