# Clinic Patient Scanning - Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VETERINARY CLINIC STAFF                       │
│                    Clinic Admin → Patients Page                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │  SCANNING BUTTONS   │
                    ├─────────────────────┤
                    │ [Scan Pet Tag] [QR] │
                    └─────────────────────┘
                         ↙        ↘
                        /          \
              ┌────────────┐    ┌─────────────┐
              │ NFC MODAL  │    │  QR MODAL   │
              └────────────┘    └─────────────┘
                    ↓                  ↓
         ┌─────────────────┐  ┌──────────────────┐
         │  NFC Reader     │  │  Camera Feed     │
         │ (API/WebSocket) │  │ (html5-qrcode)   │
         └─────────────────┘  └──────────────────┘
                    ↓                  ↓
         ┌─────────────────┐  ┌──────────────────┐
         │  Read NFC Tag   │  │  Decode QR Code  │
         │  Extract ID     │  │  Extract ID      │
         └─────────────────┘  └──────────────────┘
                    ↓                  ↓
         ┌─────────────────────────────────────┐
         │   Find Pet by ID in Patient List     │
         │   (search: _id, microchipNumber)    │
         └─────────────────────────────────────┘
                         ↓
              ┌──────────────────────┐
              │  Pet Found?          │
              └──────────────────────┘
                    ↙        ↘
                   YES        NO
                   ↓           ↓
            ┌──────────┐   ┌─────────────┐
            │ SUCCESS  │   │ ERROR STATE │
            │ "Found!" │   │ "Not Found" │
            └──────────┘   └─────────────┘
                  ↓              ↓
         ┌──────────────┐   [Retry Button]
         │ Close Modal  │
         └──────────────┘
                ↓
         ┌──────────────────────┐
         │ Open PatientDrawer    │
         │ Show Patient Profile  │
         │ ├─ Overview Tab       │
         │ ├─ Vaccine Tab        │
         │ ├─ Medical Records    │
         │ ├─ Medications        │
         │ └─ Files              │
         └──────────────────────┘
```

---

## NFC Scanning Flow (Detail)

```
User: "Scan Pet Tag"
    ↓
    ├─ [Scan Modal Opens]
    ├─ "Tap the pet tag on the NFC reader"
    ├─ [Displays NFC icon with pulsing animation]
    ↓
    ├─ [Browser NFC API Available?]
    │   ├─ YES → Use Web NFC (Android only)
    │   └─ NO → Use Backend WebSocket
    ↓
    ├─ [Waiting for NFC Tag...] (15 second timeout)
    │   ├─ Tag Detected:
    │   │   ├─ Extract UID: "04a1b2c3d4e5f6g7"
    │   │   ├─ Parse Content: "507f1f77bcf86cd799439011"
    │   │   └─ Send to Handler
    │   │
    │   └─ Timeout Reached (no tag):
    │       └─ Error: "No NFC tag detected"
    ↓
    ├─ handleNfcScanComplete(petId)
    │   ├─ Find pet: patients.find(p => p._id === petId)
    │   │   ├─ Found → SUCCESS state
    │   │   └─ Not found → ERROR state
    │
    ├─ [SUCCESS] "Pet found! Opening profile..."
    │   ├─ Close modal
    │   ├─ setSelectedPatient(pet)
    │   └─ PatientDrawer opens
    │
    └─ [ERROR] "Pet tag not recognized"
        ├─ Show error message
        ├─ Display [Retry] button
        └─ Allow user to try again
```

---

## QR Scanning Flow (Detail)

```
User: "Scan QR Code"
    ↓
    ├─ [Scan Modal Opens]
    ├─ "Align the QR code within the camera frame"
    ├─ [Displays camera feed]
    ├─ Requests camera permission
    ↓
    ├─ [Camera Ready?]
    │   ├─ YES → Start scanning
    │   └─ NO → Error: "Camera permission denied"
    ↓
    ├─ [Scanning for QR Code...]
    │   ├─ QR Code Detected:
    │   │   ├─ Decode: "https://app.com/pet/507f1f77bcf86cd799439011"
    │   │   ├─ Extract ID: "507f1f77bcf86cd799439011"
    │   │   └─ Send to Handler
    │   │
    │   └─ Timeout Reached (no QR):
    │       ├─ Continue scanning (no hard timeout for QR)
    │       └─ User can manually close
    ↓
    ├─ handleQrScanComplete(petId)
    │   ├─ Find pet: patients.find(p => p._id === petId)
    │   │   ├─ Found → SUCCESS state
    │   │   └─ Not found → ERROR state
    │
    ├─ [SUCCESS] "Pet found! Opening profile..."
    │   ├─ Close camera
    │   ├─ Close modal
    │   ├─ setSelectedPatient(pet)
    │   └─ PatientDrawer opens
    │
    └─ [ERROR] "No pet found for this QR code"
        ├─ Show error message
        ├─ Keep camera open
        ├─ Display [Retry] button
        └─ Allow user to try again
```

---

## Component Hierarchy

```
DashboardLayout
└── PatientManagementPage (main component)
    ├── Header
    │   ├── Title & Description
    │   └── NFC Info Box
    │
    ├── Species Filter & Actions
    │   ├── [All] [Dogs] [Cats]
    │   ├── [Filters] [Export]
    │   └── (existing)
    │
    ├── Search Input
    │   └── (existing)
    │
    ├── *** NEW: Scan Buttons ***
    │   ├── [Scan Pet Tag] - NFC mode
    │   └── [Scan QR Code] - QR mode
    │
    ├── Patients List
    │   ├── Loading State
    │   ├── Empty State
    │   └── Patient Cards
    │
    ├── PatientDrawer (existing)
    │   ├── Patient Header
    │   ├── Tab Navigation
    │   ├── Tab Content
    │   │   ├── OverviewTab
    │   │   ├── VaccineCardTab
    │   │   ├── MedicalRecordTab
    │   │   ├── MedicationsTab
    │   │   └── FilesTab
    │   └── Footer Actions
    │
    └── *** NEW: ScanModal (new component) ***
        ├── Header (Close button)
        ├── Content
        │   ├── Idle State
        │   ├── Scanning State
        │   │   ├── NFC: Pulsing animation
        │   │   └── QR: Camera feed
        │   ├── Error State
        │   └── Success State
        └── Footer Buttons
            ├── Cancel
            └── Retry (if error)
```

---

## State Management Flow

```
PatientManagementPage State:

├── Patient Data
│   ├── patients[]          - All patients from API
│   ├── filteredPatients[]  - Filtered by species/search
│   ├── selectedPatient     - For PatientDrawer
│   └── loading             - Fetch state
│
├── Filter & Search State  
│   ├── speciesFilter       - 'all' | 'dog' | 'cat'
│   ├── searchQuery         - Text search string
│   └── (existing)
│
├── *** NEW: Scanning State ***
│   ├── scanModalOpen       - boolean (show modal)
│   ├── scanMode            - 'nfc' | 'qr' | null
│   ├── scanStatus          - 'idle' | 'scanning' | 'success' | 'error'
│   ├── scanningPetId       - string | null (current scan ID)
│   └── scanError           - string (error message)
```

---

## Data Flow Examples

### Example 1: Successful NFC Scan

```
1. USER ACTION
   └─ Clicks "Scan Pet Tag" button

2. STATE UPDATE
   ├─ scanModalOpen = true
   ├─ scanMode = 'nfc'
   └─ scanStatus = 'scanning'

3. SCAN MODAL RENDERS
   └─ Shows NFC icon + "Tap the pet tag..."

4. NFC TAG DETECTED
   ├─ Event: { serialNumber: "04a1b2c3d4e5f6g7" }
   └─ Extract ID: "507f1f77bcf86cd799439011"

5. HANDLER CALLED
   └─ handleNfcScanComplete("507f1f77bcf86cd799439011")

6. FIND PET
   ├─ Search: patients.find(p => p._id === "507f...")
   ├─ Result: { _id: "507f...", name: "Buddy", ... }
   └─ Match: FOUND ✓

7. STATE UPDATE
   └─ setSelectedPatient(buddy)

8. EFFECTS TRIGGER
   ├─ scanModalOpen = false
   ├─ scanMode = null
   ├─ scanStatus = 'idle'
   └─ toast.success("Found Buddy!")

9. UI UPDATES
   ├─ ScanModal closes
   └─ PatientDrawer opens
       └─ Displays Buddy's profile

Result: ✅ BUDDY'S PROFILE OPEN
```

### Example 2: Failed QR Scan

```
1. USER ACTION
   └─ Clicks "Scan QR Code" button

2. STATE UPDATE
   ├─ scanModalOpen = true
   ├─ scanMode = 'qr'
   └─ scanStatus = 'scanning'

3. SCAN MODAL RENDERS
   └─ Shows camera feed + "Align QR code..."

4. INVALID QR DETECTED
   ├─ QR Content: "https://invalid-url.com/pet/999"
   ├─ Extract ID: "999"
   └─ Send to handler

5. HANDLER CALLED
   └─ handleQrScanComplete("999")

6. FIND PET
   ├─ Search: patients.find(p => p._id === "999")
   ├─ Result: undefined
   └─ Match: NOT FOUND ✗

7. STATE UPDATE
   ├─ setScanStatus('error')
   └─ Set error message

8. MODAL UPDATES
   ├─ Shows red error box
   ├─ Message: "No pet found for this QR code"
   └─ Display [Retry] button

9. USER OPTIONS
   ├─ [Retry] - Try scanning again
   ├─ [Cancel] - Close and try something else
   └─ Wait for another scan

Result: ❌ ERROR STATE, READY FOR RETRY
```

### Example 3: NFC Timeout

```
1. USER ACTION
   └─ Clicks "Scan Pet Tag", no tag nearby

2. STATE UPDATE
   ├─ scanModalOpen = true
   ├─ scanMode = 'nfc'
   └─ scanStatus = 'scanning'

3. TIMEOUT SET
   └─ nfcTimeoutRef = 15-second timer

4. WAIT FOR TAG
   └─ [Waiting...] 15 seconds pass

5. TIMEOUT TRIGGERED
   ├─ Clear WebSocket/NFC listeners
   └─ Close NFC reader

6. STATE UPDATE
   ├─ setScanStatus('error')
   └─ Error: "No NFC tag detected"

7. MODAL SHOWS
   ├─ Red error box
   ├─ Error message
   └─ [Retry] button

8. USER OPTIONS
   ├─ [Retry] - Try again
   └─ [Cancel] - Switch to QR scanning

Result: ⏱️ TIMEOUT, READY FOR RETRY
```

---

## Integration Points

### With PatientDrawer
```
ScanModal                    PatientDrawer
    ↓                             ↑
handleNfcScanComplete()
handleQrScanComplete()
    ↓
setSelectedPatient(pet)
    ↓
selectedPatient state
    ↓
<PatientDrawer patient={selectedPatient} />
    └─ Opens automatically (open={!!selectedPatient})
```

### With API/Backend
```
ScanModal
    ├─ NFC: Connect to /ws/nfc WebSocket
    │   └─ Receives: { type: 'card', data: { uid: '...', url: '...' } }
    │
    └─ QR: No backend call needed (local camera)
        └─ Extracts URL from QR code
```

### With Patient Data
```
handleScanComplete(petId)
    ├─ Search: patients.find(p => p._id === petId)
    │   └─ patients[] comes from getClinicPatients() API call
    │
    └─ Result: ClinicPatient object
        └─ Passed to setSelectedPatient()
            └─ Opens PatientDrawer with full patient data
```

---

## Error Recovery Paths

```
┌────────────────────────────────────────────────────┐
│               Error Recovery Flowchart              │
└────────────────────────────────────────────────────┘

ERROR → Display Red Alert Box
    ├── Message shows what went wrong
    ├── Suggests possible causes
    └── Provides [Retry] and [Cancel] buttons

USER CHOICE 1: [Retry]
    ├── Clear previous error
    ├── Reset scanner (camera/NFC)
    └── Go back to scanning
        ├── Success? → Open profile
        └── Error again? → Show new error

USER CHOICE 2: [Cancel]
    ├── Close modal
    ├── Return to patients list
    └── User can:
        ├── Try search instead
        ├── Try different scanning method
        ├── Click pet directly
        └── Try different pet
```

---

## Performance Timeline

```
┌─────────────────────────────────────────────────┐
│        Expected Performance Timeline             │
└─────────────────────────────────────────────────┘

CLICK SCAN BUTTON
    ↓ <100ms
MODAL OPENS
    ├─ NFC: Show pulsing animation
    └─ QR: Request camera permission
    ↓ 0-5s
    (waiting for tag/code)
    ↓ 1-3s (NFC) or 1-2s (QR)
TAG/CODE DETECTED
    ↓ <50ms
HANDLER EXECUTES
    ├─ Search patient list
    ├─ Find match (usually 1-2ms)
    └─ Update state
    ↓ <100ms
MODAL CLOSES / DRAWER OPENS
    ↓ <100ms
PATIENT PROFILE DISPLAYS
    ↓ <1s
READY FOR INTERACTION

TOTAL TIME: 2-5 seconds (scan to profile open)
```

---

## Browser DevTools Debugging

### NFC Debugging
```javascript
// In browser console, monitor NFC events:
// (Only works if WebSocket connection is open)

// Check if web NFC is available
'NDEFReader' in window
// → true (Android Chrome/Edge) or false

// Check WebSocket status
// Look for /ws/nfc connection in Network tab
```

### QR Debugging
```javascript
// Check if html5-qrcode is loaded
typeof Html5Qrcode !== 'undefined'
// → true

// Monitor camera access in DevTools
// Permissions tab → Camera → https://app.local:3000
```

### React State Debugging
```javascript
// Install React DevTools extension
// Open Components tab
// Find PatientManagementPage component
// Inspect scanning state:
// - scanModalOpen
// - scanMode
// - scanStatus
// - scanError
```

---

## Summary

This architecture ensures:
- ✅ Clean separation of concerns
- ✅ Reusable modal component for scanning
- ✅ Seamless integration with existing UI
- ✅ Robust error handling
- ✅ Excellent user experience
- ✅ Future extensibility

---

**Last Updated**: March 9, 2026
