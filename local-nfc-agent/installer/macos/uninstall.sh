#!/usr/bin/env bash
# ============================================================
#  PawSync NFC Agent — macOS Uninstall
# ============================================================
set -euo pipefail

AGENT_LABEL="com.pawsync.nfc-agent"
PLIST_PATH="$HOME/Library/LaunchAgents/${AGENT_LABEL}.plist"
INSTALL_DIR="/usr/local/pawsync-nfc-agent"

echo "============================================================"
echo "  PawSync NFC Agent — macOS Uninstall"
echo "============================================================"
echo ""

if [ -f "$PLIST_PATH" ]; then
  echo "Stopping agent..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
  echo "LaunchAgent removed."
else
  echo "LaunchAgent not found — may already be uninstalled."
fi

if [ -d "$INSTALL_DIR" ]; then
  echo "Removing installed files from $INSTALL_DIR ..."
  sudo rm -rf "$INSTALL_DIR"
  echo "Files removed."
fi

echo ""
echo "Done. PawSync NFC Bridge has been uninstalled."
