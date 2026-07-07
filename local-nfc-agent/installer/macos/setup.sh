#!/usr/bin/env bash
# ============================================================
#  PawSync NFC Agent — macOS Setup
#  Run once after extracting the zip.
#  Installs as a LaunchAgent (auto-starts at login, no window).
#
#  Prerequisites (install BEFORE running this):
#    - ACS ACR122U driver from https://www.acs.com.hk
#      Products > ACR122U > Drivers > macOS
#    - Allow the driver in System Settings > Privacy & Security
# ============================================================
set -euo pipefail

AGENT_LABEL="com.pawsync.nfc-agent"
PLIST_PATH="$HOME/Library/LaunchAgents/${AGENT_LABEL}.plist"
INSTALL_DIR="/usr/local/pawsync-nfc-agent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXE_SRC="$(dirname "$SCRIPT_DIR")/PawSync-NFC-Agent"

# The build script places PawSync-NFC-Agent one level up from installer/macos/
# When delivered in the zip, setup.sh sits alongside PawSync-NFC-Agent
if [ ! -f "$EXE_SRC" ]; then
  EXE_SRC="$SCRIPT_DIR/../PawSync-NFC-Agent"
fi

echo "============================================================"
echo "  PawSync NFC Agent — macOS Setup"
echo "============================================================"
echo ""

# ─── Verify executable exists ────────────────────────────────
if [ ! -f "$EXE_SRC" ]; then
  echo "ERROR: PawSync-NFC-Agent binary not found."
  echo "Make sure all files from the zip are in the same folder."
  exit 1
fi

# ─── Check ACS driver ────────────────────────────────────────
echo "Checking for PC/SC daemon..."
if ! pgrep -x "pcscd" > /dev/null 2>&1; then
  echo ""
  echo "WARNING: pcscd (PC/SC daemon) is not running."
  echo "Install the ACS ACR122U driver from:"
  echo "  https://www.acs.com.hk  Products > ACR122U > Drivers > macOS"
  echo "Then allow it in System Settings > Privacy & Security."
  echo "After installing the driver, run this setup script again."
  echo ""
  read -p "Continue anyway? (y/N): " CONTINUE
  if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    exit 1
  fi
fi

# ─── Install files ───────────────────────────────────────────
echo "Installing to $INSTALL_DIR ..."
sudo mkdir -p "$INSTALL_DIR/logs"
sudo cp "$EXE_SRC"    "$INSTALL_DIR/PawSync-NFC-Agent"
sudo cp "$SCRIPT_DIR/../.env" "$INSTALL_DIR/.env"

# Copy uninstall script
sudo cp "$SCRIPT_DIR/uninstall.sh" "$INSTALL_DIR/"

sudo chmod +x "$INSTALL_DIR/PawSync-NFC-Agent"
sudo chmod +x "$INSTALL_DIR/uninstall.sh"

# ─── Remove existing LaunchAgent if present ──────────────────
if [ -f "$PLIST_PATH" ]; then
  echo "Removing existing LaunchAgent..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
fi

# ─── Create LaunchAgent plist ────────────────────────────────
echo "Creating LaunchAgent..."
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AGENT_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/PawSync-NFC-Agent</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${INSTALL_DIR}/logs/agent-out.log</string>

  <key>StandardErrorPath</key>
  <string>${INSTALL_DIR}/logs/agent-err.log</string>

  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
PLIST

# ─── Load the agent ──────────────────────────────────────────
echo "Starting agent..."
launchctl load "$PLIST_PATH"

# Give it a moment to start
sleep 2

# Check if it's running
if launchctl list | grep -q "$AGENT_LABEL"; then
  echo ""
  echo "============================================================"
  echo "  Setup complete!"
  echo ""
  echo "  PawSync NFC Bridge will now:"
  echo "    - Start automatically every time you log in"
  echo "    - Restart itself if it crashes"
  echo "    - Run silently in the background (no window)"
  echo ""
  echo "  Logs : $INSTALL_DIR/logs/"
  echo ""
  echo "  Plug in the ACS ACR122U reader and you are ready."
  echo "============================================================"
else
  echo ""
  echo "WARNING: Agent may not have started."
  echo "Check logs at $INSTALL_DIR/logs/agent-err.log"
  echo "Or run manually: $INSTALL_DIR/PawSync-NFC-Agent"
fi
