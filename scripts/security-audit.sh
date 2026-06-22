#!/usr/bin/env bash
set -euo pipefail

echo "=== Beacon Security Audit ==="
echo ""
echo "1. npm audit (production dependencies)"
npm audit --omit=dev || true
echo ""
echo "2. Outdated direct dependencies"
npm outdated --workspaces || true
echo ""
echo "Review docs/security-checklist.md for OWASP and launch blockers."
