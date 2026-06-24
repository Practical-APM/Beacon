#!/usr/bin/env bash
# Vercel web-only build — builds @beacon/shared + @beacon/web only (never @beacon/api).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Beacon web Vercel build (shared + web only) ==="

echo "Building @beacon/shared..."
npm run build --workspace=@beacon/shared

echo "Building @beacon/web..."
npm run build --workspace=@beacon/web

echo "Vercel web build complete."
