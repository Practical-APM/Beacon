#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Simulating Vercel install + build for @beacon/web..."
npm ci
npx turbo build --filter=@beacon/web
echo "Vercel build simulation passed."
