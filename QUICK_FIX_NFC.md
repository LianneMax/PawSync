# Quick Start: NFC Tag Management Fixes for Localhost

## What Was Fixed

1. **NFC Service Not Initializing** - Changed `NFC_MODE=remote` to `NFC_MODE=local` in `backend/.env`
2. **No Pending Requests** - Seeded 4 test pending NFC tag requests in the database

## Action Required: Restart Your Backend Server

The `.env` file was changed, so your backend needs to restart to pick up the new configuration.

### Option 1: If you have a terminal with `npm run dev` running

1. Press `Ctrl+C` to stop the dev server
2. Run:
   ```bash
   npm run dev
   ```
3. Wait for the server to start - you should see these messages indicating the fix is working:
   ```
   ✓ Connected to MongoDB
   [NFC] Starting NFC worker process...
   [NFC] Service initialized — scanning for readers...
   [WS] NFC WebSocket server ready at /ws/nfc
   🚀 Server running on http://localhost:5001
   🚀 NFC WebSocket at ws://localhost:5001/ws/nfc
   ```

### Option 2: If you can't find the terminal

1. Open a new terminal in the PawSync directory
2. Run:
   ```bash
   npm run dev
   ```

## Verify the Fixes

After restarting:

1. **Refresh your browser** at `http://localhost:3000/clinic-admin/nfc`
2. **Check for these indicators:**
   - [ ] **NFC Reader Status** should show either:
     - ✅ "NFC Reader Connected: [reader name]" (if you have a reader plugged in)
     - ✅ "No NFC reader detected" (if no reader is plugged in, but service is running)
   - [ ] **Pending Tag Requests** section should show:
     - "Pending Tag Requests (4)" 
     - Four pet cards: Bobi, Chutni, Tamago, Yoru Valdes
   - [ ] Can search for pets and see "Write Tag" button

## What Changed in the Code

### File: `backend/.env`
```diff
- NFC_MODE=remote
+ NFC_MODE=local
```

**Why:** 
- `remote` mode = Backend expects a separate local-nfc-agent process (for production)
- `local` mode = Backend initializes its own NFC worker process (for development)

### File: `backend/scripts/seedPendingNFCRequests.ts` (NEW)
Created a script to populate test data. Already executed and created 4 pending requests.

## For Debugging

If something doesn't work after restarting:

1. **Check browser console** (F12) for any JavaScript errors
2. **Check backend logs** for NFC initialization messages
3. **Run this command** to check if API is responding:
   ```bash
   curl http://localhost:5001/api/nfc/clinic/pending-requests -H "Authorization: Bearer YOUR_TOKEN"
   ```
4. See the full troubleshooting guide in `NFC_LOCALHOST_FIXES.md`

---

**Summary:** Change made to `backend/.env`, restart your dev server, refresh the browser, and you're done! ✨
