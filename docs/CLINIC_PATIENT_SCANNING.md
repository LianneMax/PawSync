# Clinic Patient Scanning Implementation

## Overview

This document describes the implementation of NFC and QR code scanning buttons on the Clinic Admin Patients page. These features allow veterinary clinic staff to quickly open pet profiles by scanning either an NFC pet tag or a QR code.

## Features Implemented

### 1. **Two Scanning Buttons**
Located directly under the search bar on the Patients page:
- **Scan Pet Tag (NFC)** - Blue/teal button for NFC scanning
- **Scan QR Code** - Border button for QR code scanning

### 2. **NFC Scanning (Pet Tag)**
- **Primary Method**: Browser Web NFC API (for mobile devices with NFC support)
- **Fallback Method**: Backend NFC Reader via WebSocket (for desktop with USB NFC reader)
- **Functionality**:
  - Opens an interactive modal with scanning instructions
  - Displays animated NFC icon while waiting for tag
  - 15-second timeout with user-friendly error message
  - Automatically opens the pet profile when tag is detected
  
### 3. **QR Code Scanning**
- **Library**: `html5-qrcode` (already in project dependencies)
- **Functionality**:
  - Opens camera feed in a modal
  - Displays QR scanner with animated corner guides
  - Automatically detects and decodes QR codes
  - Extracts pet ID from QR code data
  - Opens pet profile on successful scan

### 4. **Error Handling**
- **NFC Errors**:
  - "No NFC tag detected" - When scan times out
  - "Pet tag not recognized" - When tag UID is invalid
  - "NFC reader not available" - When backend NFC not available
  
- **QR Errors**:
  - "QR code could not be read" - When QR scanner fails
  - "No pet found for this QR code" - When scanned ID doesn't match any pet

- **UI Feedback**:
  - Error messages display in red alert boxes
  - Retry button appears for failed scans
  - Scanning indicators (loading spinners) during active scanning

### 5. **Pet Identification**
The system matches scan results using multiple identifiers:
- **Pet ID** (`_id`) - Primary identifier used by the system
- **Microchip Number** (`microchipNumber`) - Alternative identifier if available

Both NFC tags and QR codes should contain one of these identifiers to be successfully scanned.

## UI Layout

```
┌─ Patients Page ────────────────────────────────┐
│                                                  │
│ Header: Patient Management                      │
│ [NFC Scanning Info Box]                        │
│                                                  │
│ Species Filter & Actions                        │
│ [All] [Dogs] [Cats]    [Filters] [Export]      │
│                                                  │
│ Search Bar                                       │
│ [Search patients...]                            │
│                                                  │
│ *** NEW: Scanning Buttons ***                   │
│ [Scan Pet Tag] [Scan QR Code]                  │
│                                                  │
│ Patients List                                    │
│ ┌──────────────────────────────────────────┐   │
│ │ [Photo] Pet Name | Owner | Contact       │   │
│ │         Breed · Species · Sex             │   │
│ │         Owner · Contact · Blood · Records│   │
│ │         Last visit: Oct 15, 2024          │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
└───────────────────────────────────────────────┘
```

## Scanning Modal UI

### Idle State
- Shows appropriate icon (NFC or QR)
- Displays instructions: "Tap the pet tag on the NFC reader" or "Align the QR code within the camera frame"
- Cancel button

### Scanning State
- **NFC**: Animated pulsing rings and NFC icon
- **QR**: Live camera feed with QR scanner overlay
- Displays "Scanning..." with spinner
- Cancel button

### Error State
- Red alert box with error message
- Retry button to attempt scanning again
- Cancel button

### Success State  
- Green checkmark with "Pet found! Opening profile..." message
- Automatically closes after profile opens

## Code Structure

### New Additions to `frontend/app/clinic-admin/patients/page.tsx`

#### 1. **Imports**
```typescript
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode, Loader } from 'lucide-react'
```

#### 2. **New Type Definitions**
```typescript
type ScanMode = 'nfc' | 'qr' | null
type ScanStatus = 'idle' | 'scanning' | 'success' | 'error'
```

#### 3. **New Component: `ScanModal`**
- Manages NFC and QR code scanning workflows
- Handles device permission requests
- Manages scanner lifecycle (start/stop)
- Provides real-time feedback to users
- Props:
  - `open`: boolean - Modal visibility
  - `onClose`: () => void - Close handler
  - `scanMode`: 'nfc' | 'qr' | null
  - `scanStatus`: 'idle' | 'scanning' | 'success' | 'error'
  - `onScanComplete`: (petId: string) => void - Callback when scan succeeds

#### 4. **New State Variables in `PatientManagementPage`**
```typescript
const [scanModalOpen, setScanModalOpen] = useState(false)
const [scanMode, setScanMode] = useState<ScanMode>(null)
const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
const [scanningPetId, setScanningPetId] = useState<string | null>(null)
const [scanError, setScanError] = useState<string>('')
```

#### 5. **Handler Functions**
- `handleNfcScanComplete(petId: string)` - Processes NFC scan results
- `handleQrScanComplete(petId: string)` - Processes QR scan results
- `handleStartScan(mode: ScanMode)` - Initiates scanning mode

#### 6. **UI Changes**
- Added two scanning buttons after search input
- Integrated ScanModal component into render tree
- Buttons trigger appropriate scan modes

## How It Works

### NFC Scanning Flow
1. User clicks "Scan Pet Tag" button
2. `handleStartScan('nfc')` opens the modal
3. ScanModal component attempts Web NFC API first
4. If Web NFC unavailable, falls back to backend WebSocket
5. Modal displays "Tap the pet tag" instruction
6. When tag is detected, UID is extracted
7. `handleNfcScanComplete()` searches for matching pet
8. If found, PatientDrawer opens showing pet profile
9. If not found, error message appears with retry option

### QR Scanning Flow
1. User clicks "Scan QR Code" button
2. `handleStartScan('qr')` opens the modal
3. ScanModal requests camera permission
4. Camera feed displays with QR scanner overlay
5. When QR code is detected, it's decoded
6. Pet ID is extracted from QR code content
7. `handleQrScanComplete()` searches for matching pet
8. If found, PatientDrawer opens showing pet profile
9. If not found, error message appears with retry option

### Pet Profile Opening
- When a pet is found, `setSelectedPatient(pet)` is called
- This triggers the existing PatientDrawer to open
- **No changes needed to existing pet profile UI or logic**
- The scanning feature seamlessly integrates with current workflow

## Requirements for NFC/QR Code Data

### NFC Tags
The NFC tag should contain:
- Pet ID (recommended): The `_id` field from the database
- Alternative: Microchip number if available

**Format Examples**:
- Direct ID: `507f1f77bcf86cd799439011`
- URL format: `https://app.com/pet/507f1f77bcf86cd799439011`

### QR Codes
The QR code should contain:
- Pet ID (recommended): The `_id` field from the database
- Alternative: Microchip number if available
- URL format: `https://app.com/pet/507f1f77bcf86cd799439011`

**QR Code can be:**
- Auto-generated when pets are created (already implemented in backend)
- Printed on physical pet tags
- Sent via email to pet owners
- Displayed in records for reference

## Testing

### Prerequisites
- Browser with camera access (for QR scanning)
- NFC reader (USB or mobile device with Web NFC support)
- Pet records already in the system with valid _id values

### Test NFC Scanning
1. Navigate to Clinic Admin → Patients page
2. Click "Scan Pet Tag" button
3. Hold a valid NFC tag to reader (or mobile device)
4. Verify pet profile opens
5. If no pet found, verify error message is displayed

### Test QR Scanning
1. Navigate to Clinic Admin → Patients page
2. Click "Scan QR Code" button
3. Allow camera permission
4. Scan a QR code containing a valid pet ID
5. Verify pet profile opens
6. If QR code invalid, verify error message is displayed

### Test Error Handling
1. Try scanning with invalid/unknown ID
2. Try scanning with no pets in database
3. Cancel scan mid-operation
4. Retry after error
5. Test timeout (wait 15+ seconds for NFC)

## Troubleshooting

### "No NFC tag detected" Error
- Ensure NFC tag is properly formatted
- Check tag is compatible (MIFARE/NTAG types)
- Verify backend NFC reader is connected (if using USB reader)
- Try again with tag closer to reader

### "QR code could not be read" Error
- Ensure adequate lighting
- QR code should be in clear view
- Check QR code is not damaged or faded
- Try repositioning phone/camera

### Pet Not Found Error
- Verify pet exists in the clinic's patient list
- Confirm the ID in the tag/QR matches a pet's _id
- Check if pet is filtered out by species filter
- Ensure correct clinic admin is logged in

### Camera Permission Denied
- Check browser settings allow camera access
- Grant permission when prompted
- For mobile, check system settings allow camera access
- Try in incognito/private mode if permissions cached

## Browser Support

### NFC Scanning
- **Web NFC API**: Chrome/Edge on Android (not iOS/macOS)
- **WebSocket Fallback**: All browsers (requires backend USB reader)

### QR Scanning
- **html5-qrcode**: All modern browsers with camera access
- Mobile: iOS Safari 14.5+, Chrome, Edge, Firefox
- Desktop: Chrome, Edge, Firefox, Safari

## Performance Considerations

- **Scan Speed**: 1-3 seconds typical for both NFC and QR
- **Memory**: QR scanner uses minimal memory, cleaned up on modal close
- **Timeout**: 15 seconds max waiting for tag/code
- **No Impact on Patients List**: Scanning doesn't affect existing patient data or listings

## Future Enhancements

1. **Batch Scanning**: Scan multiple pets in sequence
2. **Scan History**: Show recent scans in sidebar
3. **Auto-Retry**: Automatically retry failed scans
4. **Analytics**: Track scan success rates
5. **Audio Feedback**: Play sound on successful scan
6. **Barcode Support**: Add support for barcode scanning
7. **Customization**: Allow clinics to customize scan instructions
8. **Mobile App**: Native NFC support for iOS/Android

## Files Modified

- `frontend/app/clinic-admin/patients/page.tsx` - Added scanning UI and logic

## Dependencies

- `html5-qrcode` - QR code scanning library (already in package.json)
- `lucide-react` - Icons for scanning buttons (already in package.json)
- `sonner` - Toast notifications for success/error (already in package.json)

## Related Documentation

- [NFC Implementation Status](./NFC_IMPLEMENTATION_STATUS.md) - Backend NFC infrastructure
- [NFC Quick Start](./docs/NFC_QUICK_START.md) - NFC system overview
- [Database Schema](./database-schema.sql) - Pet model structure
- [Architecture](./ARCHITECTURE.md) - System architecture overview

---

**Status**: ✅ Implemented and Ready for Testing  
**Last Updated**: March 9, 2026  
**Author**: GitHub Copilot
