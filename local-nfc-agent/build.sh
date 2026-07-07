#!/usr/bin/env bash
# ============================================================
#  PawSync NFC Agent — macOS build script
#  Run this on a Mac to produce PawSync-NFC-Agent-macOS.zip
#  Prerequisite: npm, node 18+ installed on this machine
# ============================================================
set -euo pipefail

# ─── Configure these before building ────────────────────────
BACKEND_URL="https://pawsync-backend.onrender.com"
NFC_SECRET="7c8c69bfdc984c880f100516c9064ac91e96c4130414fdbc924ab6c0eed2d07e"
# ────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$SCRIPT_DIR/release"
DIST_DIR="$RELEASE_DIR/dist-macos"
ZIP_NAME="PawSync-NFC-Agent-macOS.zip"

# Detect architecture for pkg target
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  PKG_TARGET="node18-macos-arm64"
  EXE_SUFFIX="macos-arm64"
else
  PKG_TARGET="node18-macos-x64"
  EXE_SUFFIX="macos-x64"
fi

echo "============================================================"
echo "  PawSync NFC Agent — macOS Build"
echo "  Target : $PKG_TARGET"
echo "  Output : $ZIP_NAME"
echo "============================================================"
echo ""

cd "$SCRIPT_DIR"

# 1. Clean release dir
echo "[1/7] Cleaning release directory..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/logs"

# 2. Install dependencies
echo "[2/7] Installing dependencies..."
npm install

# 3. Compile TypeScript
echo "[3/7] Compiling TypeScript..."
npm run build

# 4. Package with pkg
echo "[4/7] Bundling executable..."
npx pkg . \
  --target "$PKG_TARGET" \
  --output "$DIST_DIR/PawSync-NFC-Agent" \
  --compress GZip

chmod +x "$DIST_DIR/PawSync-NFC-Agent"

# 5. Copy native .node files next to executable (belt-and-suspenders)
echo "[5/7] Copying native modules..."
find node_modules -name "*.node" -exec cp {} "$DIST_DIR/" \; 2>/dev/null || true

# 6. Create pre-filled .env
echo "[6/7] Writing .env..."
cat > "$DIST_DIR/.env" <<ENV
# PawSync NFC Agent — pre-configured, do not edit
BACKEND_URL=$BACKEND_URL
NFC_SECRET=$NFC_SECRET
POLL_INTERVAL_MS=3000
DRAIN_INTERVAL_MS=30000
LOG_LEVEL=info
ENV

# 7. Copy installer scripts
echo "[7/7] Copying installer scripts..."
cp "$SCRIPT_DIR/installer/macos/setup.sh"     "$DIST_DIR/"
cp "$SCRIPT_DIR/installer/macos/uninstall.sh"  "$DIST_DIR/"
chmod +x "$DIST_DIR/setup.sh" "$DIST_DIR/uninstall.sh"

# Zip
echo ""
echo "Creating archive..."
cd "$RELEASE_DIR"
zip -r "$ZIP_NAME" dist-macos/
echo ""
echo "============================================================"
echo "  Done!"
echo "  Archive : $RELEASE_DIR/$ZIP_NAME"
echo ""
echo "  Deliver this zip to clinic admin."
echo "  Admin steps:"
echo "    1. Install ACS ACR122U driver from acs.com.hk"
echo "    2. Extract zip"
echo "    3. Right-click setup.sh → Open (macOS Gatekeeper)"
echo "    4. Plug in ACR122U — done"
echo "============================================================"
