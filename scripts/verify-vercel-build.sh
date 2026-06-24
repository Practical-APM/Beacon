#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Simulating Vercel install + build for @beacon/web (from apps/web cwd)..."
cd apps/web
npm ci --prefix=../..
bash ./vercel-build.sh
echo "Vercel build simulation passed."
