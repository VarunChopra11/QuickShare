#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Starting QuickShare Frontend development server..."
cd "$REPO_DIR/frontend"
exec npm run dev -- --host 0.0.0.0
