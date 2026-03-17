#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_FILE="$SCRIPT_DIR/clawphone.service"
SYSTEMD_DIR="$HOME/.config/systemd/user"

echo "==> Building ClawPhone"
bash "$SCRIPT_DIR/build.sh"

echo "==> Installing systemd user service"
mkdir -p "$SYSTEMD_DIR"
cp "$SERVICE_FILE" "$SYSTEMD_DIR/clawphone.service"

# Update paths in service file
sed -i "s|/path/to/clawphone|$PROJECT_DIR|g" "$SYSTEMD_DIR/clawphone.service"

systemctl --user daemon-reload
systemctl --user enable clawphone.service
systemctl --user start clawphone.service

echo "==> ClawPhone service installed and started"
echo "Check status: systemctl --user status clawphone"
echo "View logs:    journalctl --user -u clawphone -f"
