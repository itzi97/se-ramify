#!/usr/bin/env bash
# Regenerate examples/: the example project's hand-ins (E1, E2, E3, Final)
# exported through the app's own checklist, plus a PDF of each memoria.
# Build first (`npm run build`); needs pandoc for the PDFs.
set -euo pipefail
cd "$(dirname "$0")/../.."
port=4180
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
rm -rf examples/E1 examples/E2 examples/E3 examples/Final
node tests/e2e/example-deliverables.mjs $port examples
npx tsx tests/e2e/ai-pack.ts examples/Final/ia
# Smaller images (optional: needs Python with Pillow).
python3 tests/e2e/shrink-png.py examples 2>/dev/null || echo "Pillow not found: PNGs left as exported"
node tests/e2e/memoria-pdf.mjs examples
