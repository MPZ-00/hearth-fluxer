#!/usr/bin/env bash
set -euo pipefail

# Installs the hearth-fluxer systemd unit, filling in the current user, this
# checkout's path, and the active node binary. Run from anywhere; the repo
# root is derived from this script's location.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$SCRIPT_DIR/hearth-fluxer.service.template"
UNIT_NAME="hearth-fluxer.service"
DEST="/etc/systemd/system/$UNIT_NAME"

if [ ! -f "$TEMPLATE" ]; then
    echo "Template not found: $TEMPLATE" >&2
    exit 1
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
    echo "node not found on PATH. Install Node.js first, or run this script from a shell where it's available." >&2
    exit 1
fi

if [ ! -d "$REPO_ROOT/dist" ]; then
    echo "Warning: $REPO_ROOT/dist doesn't exist yet. Run 'npm ci && npm run build' before starting the service." >&2
fi

sed \
    -e "s#__USER__#$(whoami)#" \
    -e "s#__WORKDIR__#$REPO_ROOT#" \
    -e "s#__NODE_BIN__#$NODE_BIN#" \
    "$TEMPLATE" | sudo tee "$DEST" > /dev/null

sudo systemctl daemon-reload

echo "Installed $DEST"
echo "Review it, then run:"
echo "  sudo systemctl enable --now $UNIT_NAME"
echo "  journalctl -u $UNIT_NAME -f"
