#!/usr/bin/env bash
# Browser scenarios against the production build: build first (`npm run build`).
set -euo pipefail
cd "$(dirname "$0")/../.."
port=4179
npx vite preview --port $port --strictPort >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
for _ in $(seq 50); do curl -s "http://localhost:$port" >/dev/null && break; sleep 0.2; done
node tests/e2e/smoke.mjs $port
node tests/e2e/graph-interact.mjs $port
