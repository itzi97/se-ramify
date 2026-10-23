#!/usr/bin/env bash
# Browser scenarios against the production build: build first (`npm run build`).
set -euo pipefail
cd "$(dirname "$0")/../.."
port=4179
# A server left over from an earlier run would answer instead of this build.
if curl -s "http://localhost:$port" >/dev/null; then
  echo "Port $port is already in use; stop that server first." >&2
  exit 1
fi
# Its own process group, so stopping it stops vite too, not just the npx wrapper.
set -m
npx vite preview --port $port --strictPort >/dev/null 2>&1 &
server=$!
set +m
trap 'kill -- -$server 2>/dev/null || true' EXIT
for _ in $(seq 50); do curl -s "http://localhost:$port" >/dev/null && break; sleep 0.2; done
node tests/e2e/smoke.mjs $port
node tests/e2e/graph-interact.mjs $port
node tests/e2e/team.mjs $port
node tests/e2e/shell.mjs $port
node tests/e2e/editors-interact.mjs $port
