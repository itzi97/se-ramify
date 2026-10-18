#!/usr/bin/env bash
# Installs a se-ramify AppImage for the current user: puts it in ~/.local/bin,
# adds a launcher entry and an icon. No root needed.
#
#   ./scripts/install.sh path/to/se-ramify_x.y.z_amd64.AppImage
#   ./scripts/install.sh            # looks for the newest AppImage in src-tauri/target/release/bundle/appimage
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="${1:-}"
if [[ -z "$src" ]]; then
  src="$(ls -t "$here"/src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null | head -n1 || true)"
fi
if [[ -z "$src" || ! -f "$src" ]]; then
  echo "No AppImage found. Build one with 'npm run tauri build' or pass a path." >&2
  exit 1
fi

bin="$HOME/.local/bin"
apps="$HOME/.local/share/applications"
icons="$HOME/.local/share/icons/hicolor/512x512/apps"
mkdir -p "$bin" "$apps" "$icons"

install -m 755 "$src" "$bin/se-ramify"
install -m 644 "$here/src-tauri/icons/icon.png" "$icons/se-ramify.png"

cat > "$apps/se-ramify.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=se-ramify
Comment=Software Engineering diagrams
Exec=$bin/se-ramify %U
Icon=se-ramify
Terminal=false
Categories=Education;Development;
StartupWMClass=se-ramify
DESKTOP

command -v update-desktop-database >/dev/null && update-desktop-database "$apps" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "Installed to $bin/se-ramify and added a launcher entry."
case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: $bin is not on your PATH; the launcher entry works regardless." ;; esac
