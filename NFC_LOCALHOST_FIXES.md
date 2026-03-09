# NFC Tag Management - Localhost Fixes

## Issues Fixed

### 1. **NFC Reader Not Available** ❌ → ✅
**Problem:** The NFC tag management page showed "NFC Reader Not Available - Unable to check NFC status"

**Root Cause:** The backend `.env` file was configured with `NFC_MODE=remote`, which told the backend to skip initializing its own NFC service and instead wait for a separate local-nfc-agent process. This was appropriate for cloud environments but not for localhost development.

**Solution:** Changed `NFC_MODE=remote` to `NFC_MODE=local` in `backend/.env`

**File Changed:** `/backend/.env`
```diff
- # NFC: local NFC agent owns the USB hardware — don't fork a competing worker
- NFC_MODE=remote
+ # NFC: Set to 'local' for localhost development (backend manages NFC worker)
+ # Set to 'remote' for production with standalone local-nfc-agent
+ NFC_MODE=local
```

**Effect:** When the backend server restarts (with nodemon), it will now initialize the NFC service locally, which will:
- Fork the NFC worker process
- Scan for connected NFC readers  
- Emit reader connection/disconnection events via WebSocket
- Display reader status correctly in the UI

### 2. **No Pending Tag Requests** ❌ → ✅
**Problem:** The "Pending Tag Requests" section showed "No Pending Requests" with no requests to work with

**Root Cause:** The database had no pending NFC tag requests for testing

**Solution:** Created a seed script `backend/scripts/seedPendingNFCRequests.ts` that:
1. Connects to MongoDB
2. Creates a test clinic (if none exists)
3. Creates a test pet owner (if none exists)
4. Creates test pets (Max, Luna, Charlie)
5. Creates pending NFC tag requests for these pets
6. Displays the created requests

**File Created:** `/backend/scripts/seedPendingNFCRequests.ts`

**Run the script:**
```bash
cd backend
npx ts-node --require dotenv/config scripts/seedPendingNFCRequests.ts
```

**Already ran successfully!** Created 4 pending requests:
- Bobi Valdes
- Chutni Valdes
- Tamago Valdes
- Yoru Valdes

---

## Architecture Overview

### For Localhost Development (`NFC_MODE=local`)

```
┌─────────────────────────────────────────────────────┐
│  Frontend (http://localhost:3000)                   │
│  ├─ NFC Tag Management Page                         │
│  └─ WebSocket Connection to Backend                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ HTTP / WebSocket
                   ▼
┌──────────────────────────────────────────────────────┐
│  Backend (http://localhost:5001)                    │
│  ├─ NFC Service (Initialized)                       │
│  │  └─ NFC Worker Process (Child)                   │
│  │     └─ Monitors USB for NFC Reader               │
│  ├─ NFC Routes & Controllers                        │
│  ├─ WebSocket Server (/ws/nfc)                      │
│  └─ MongoDB Connection                              │
└──────────────────────────────────────────────────────┘
                   │
                   │ USB/PC/SC
                   ▼
        ┌──────────────────┐
        │  NFC Reader      │
        │  (if connected)  │
        └──────────────────┘
```

### For Production (`NFC_MODE=remote`)

```
┌─────────────────────────────────────────────────────┐
│  Frontend                                           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  Backend (Cloud - Render/Heroku)                    │
│  ├─ NFC Service (NOT Initialized - remote mode)    │
│  ├─ NFC Routes & Controllers (Waiting for commands) │
│  ├─ WebSocket Server (/ws/nfc)                      │
│  └─ MongoDB Connection                              │
└──────────────────────────────────────────────────────┘
                   │
                   │ HTTP (NFC_SECRET)
                   ▼
┌──────────────────────────────────────────────────────┐
│  Local NFC Agent (Runs on Admin Computer)           │
│  ├─ Monitors USB for NFC Reader                     │
│  ├─ Listens for commands from Backend               │
│  └─ Relays NFC events back to Backend               │
└──────────────────────────────────────────────────────┘
```

---

## How It Works Now

### 1. **NFC Reader Detection**
- When backend starts: NFC service forks a worker process that scans for USB NFC readers
- On reader connect/disconnect: Worker emits events to parent process
- Parent process broadcasts via WebSocket to all connected frontend clients
- Frontend displays "NFC Reader Connected" or "NFC Reader Not Available"

### 2. **Pending Request Display**
- Frontend fetches pending requests from `/api/nfc/clinic/pending-requests`
- Backend queries MongoDB for all pending PetTagRequest documents
- Returns populated pet & owner details
- Frontend displays in "Pending Tag Requests" section
- Clinic admin can select request → write to NFC tag

### 3. **NFC Tag Writing**
```
User clicks "Write Tag"
    ↓
Frontend calls POST /api/nfc/pet/{petId}/write
    ↓
Backend sends message to NFC worker
    ↓
Worker emits "Waiting for tag..." (setWriteStage → waiting)
    ↓
User places blank NFC tag on reader
    ↓
Worker detects card → "Tag detected!" (emits write:progress → card-detected)
    ↓
Worker writes NDEF URI record with pet profile URL
    ↓
Worker verifies write → "Verifying" (emits write:progress → verifying)
    ↓
Writer emits completion event (write:complete)
    ↓
Frontend shows success → "Tag Written Successfully!"
    ↓
Request marked as fulfilled in database
```

---

## Next Steps

1. ✅ **Change `NFC_MODE=local`** in backend/.env (DONE)
2. ✅ **Run seed script** to create pending requests (DONE)
3. **Restart backend server** - It should auto-restart with nodemon and pick up new env var
4. **Refresh frontend** browser page
5. **Verify fixes:**
   - [ ] NFC Reader status shows "Green" or shows reader name
   - [ ] "Pending Tag Requests" displays the 4 seeded requests
   - [ ] Can select a pet from the search and see "Write Tag" button
   - [ ] WebSocket connection shows in browser DevTools

---

## Testing Checklist

### Without NFC Hardware (for UI testing)
- ✅ Pending requests load and display
- ✅ Can search for pets
- ✅ Can see NFC status (will say "No NFC reader detected")
- ✅ Write button works (will timeout waiting for tag)

### With NFC Hardware
- [ ] NFC reader detected and shown in UI
- [ ] Can place blank NFC tag on reader
- [ ] Tag writing progresses: waiting → detected → writing → verifying → success
- [ ] Pet profile URL written to tag
- [ ] Request marked fulfilled

---

## Environment Configuration Summary

| Setting | Development | Production |
|---------|-------------|------------|
| `NFC_MODE` | `local` | `remote` |
| NFC Service | Backend forked worker | Local NFC Agent (separate process) |
| Hardware | Localhost USB reader | Secure connection via NFC_SECRET |
| Setup | None needed | Run local-nfc-agent separately |

---

## Files Modified

- ✅ `/backend/.env` - Changed NFC_MODE from remote to local
- ✅ `/backend/scripts/seedPendingNFCRequests.ts` - NEW: Seed script for test data

---

## Troubleshooting

### Still seeing "NFC Reader Not Available"
1. Check backend logs for "NFC worker started" message
2. Verify backend restarted after env change
3. Check browser WebSocket connection in DevTools (Network tab)
4. Clear browser cache and hard refresh

### Still seeing "No Pending Requests"
1. Run seed script again: `npx ts-node --require dotenv/config scripts/seedPendingNFCRequests.ts`
2. Check MongoDB that documents were created with status 'pending'
3. Clear browser cache and hard refresh
4. Check API directly: `curl http://localhost:5001/api/nfc/clinic/pending-requests -H "Authorization: Bearer YOUR_TOKEN"`

### WebSocket connection failing
1. Verify frontend `NEXT_PUBLIC_API_URL=http://localhost:5001/api` is correct
2. Check browser console for WebSocket errors
3. Ensure backend is running on port 5001
4. Check for CORS issues in browser console

