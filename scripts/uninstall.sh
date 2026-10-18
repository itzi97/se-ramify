#!/usr/bin/env bash
# Removes what scripts/install.sh added. Diagrams are never touched.
set -euo pipefail
rm -f "$HOME/.local/bin/se-ramify" "$HOME/.local/share/applications/se-ramify.desktop" "$HOME/.local/share/icons/hicolor/512x512/apps/se-ramify.png"
command -v update-desktop-database >/dev/null && update-desktop-database "$HOME/.local/share/applications" || true
echo "Removed se-ramify. Your diagrams folder is untouched."
