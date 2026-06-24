#!/usr/bin/env bash
# Vercel web-only build — avoids `turbo run build`, which can pull in @beacon/api.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "Building @beacon/shared..."
npm run build --workspace=@beacon/shared

echo "Building @beacon/web..."
npm run build --workspace=@beacon/web

echo "Vercel web build complete."
