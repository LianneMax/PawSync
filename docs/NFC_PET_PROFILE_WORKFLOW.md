# NFC Pet Profile Workflow

## Overview
This document describes the complete NFC workflow for PawSync, which enables pet owners to link their pets to NFC tags that can be attached to pet collars.

## Workflow Stages

### Stage 1: Pet Profile Creation
When a pet owner creates a new pet profile:

1. **Pet Registration**
   - User fills out pet information (name, breed, age, etc.)
   - Pet is saved to MongoDB with a unique ID
   - A QR code is automatically generated and stored with the pet record

2. **QR Code Generation**
   - Backend generates QR code pointing to: `https://yourapp.com/pet/{petId}`
   - QR code is stored as a data URL in the pet model
   - Pet owners can print/view the QR code from their pet profile page

### Stage 2: NFC Tag Request (Pet Owner)
Pet owners can request an NFC tag from their clinic:

1. Pet owner visits their pet profile
2. Requests to create/order an NFC tag
3. Clinic receives notification to prepare the tag

### Stage 3: NFC Tag Writing (Clinic Side)
Clinics can write NFC tags using their NFC reader:

1. **Get Pet Information**
   ```
   GET /api/nfc/pet/{petId}/for-writing
   ```
   Returns pet details and the profile URL to write

2. **Start Write Process**
   ```
   POST /api/nfc/pet/{petId}/write
   ```
   - Authenticates clinic staff
   - Initiates NFC write mode
   - Waits for tag placement (30-60 second timeout)
   - When tag is detected, writes the pet profile URL to it

3. **NFC Tag Content**
   - Format: NDEF URI Record (RFC standards)
   - Content: `https://yourapp.com/pet/{petId}`
   - Protocol Code: 0x04 (https://)
   - Can be read by any NFC-enabled device

4. **Confirm Write**
   - NFC tag writing completes
   - Tag ID is recorded in pet database
   - Pet owner is notified

### Stage 4: Using the NFC Tag
Once written, the NFC tag can be used via:

1. **Scanning with NFC Reader**
   - Clinic/vet with NFC reader scans tag attached to pet
   - Reads the pet profile URL
   - Shows pet health records, owner info, medical history
   - Displays contact information in case of emergency

2. **Unknown Pet Scenario**
   - If found pet has NFC tag
   - Scan with any NFC-enabled phone
   - Automatically opens pet profile
   - Shows owner contact details
   - Facilitates safe return home

## Database Schema

### Pet Model Updates
```typescript
{
  _id: ObjectId,
  ownerId: ObjectId,
  name: String,
  species: String,
  breed: String,
  photo: String,
  weight: Number,
  allergies: [String],
  dateOfBirth: Date,
  notes: String,
  
  // New fields for NFC
  qrCode: String,        // Base64 data URL of QR code
  nfcTagId: String,      // NFC tag UID when written
  
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Reading NFC Data
- `GET /api/nfc/status` - Check if NFC service is running
- `GET /api/nfc/readers` - List connected NFC readers

### Pet Profile & NFC
- `GET /api/nfc/pet/{petId}/for-writing` - Get pet data for writing
- `GET /api/nfc/pet/{petId}/status` - Check NFC tag status
- `GET /api/nfc/pet/{petId}/instructions` - Get writing instructions
- `POST /api/nfc/pet/{petId}/write` - Initiate NFC write (with auth)
- `POST /api/nfc/pet/{petId}/record-writing` - Record tag ID (with auth)

## Technical Implementation

### QR Code Generation
- Uses `qrcode` library for automatic QR code creation
- Generated when pet is created
- Stored as PNG data URL in database
- Used for printing/sharing pet information

### NFC Writing Process
- Clinic initiates write request
- Backend sends message to NFC worker process
- Worker enters "write mode"
- Next card detected triggers NDEF encoding
- Encodes URL as NDEF URI record
- Writes to card blocks 4+ (manufacturer preserves blocks 0-3)
- Returns write success/failure with card UID

### NFC Reading Process
- Any NFC scanner can read the tag
- Automatic parsing of NDEF records  
- Extracts pet profile URL
- Redirects to pet profile page
- Shows all relevant information to finder

## NFC Data Format

### NDEF Record Structure
```
Header Byte: 0xD1
  - MB (Message Begin): 1
  - ME (Message End): 1
  - CF (Chunk Flag): 0
  - SR (Short Record): 1
  - IL (ID Length): 0
  - TNF (Type Name Format): 1 (Well-Known)

Type Length: 1
Payload Length: varies (e.g., 50+ bytes for URL)
Type: 'U' (0x55) - URI record type
Payload:
  - Protocol Code: 0x04 (https://)
  - URI Part: "yourapp.com/pet/{petId}"
```

## Security Considerations

1. **URL Format**
   - Full URL includes domain (prevents deeplink attacks)
   - Pet ID is required but doesn't expose sensitive data

2. **Pet Profile Access**
   - Public viewing of pet profile (read-only)
   - Owner contact visible for emergency purposes
   - Medical records visible to assigned vets

3. **Write Authorization**
   - Only authenticated clinic staff can write tags
   - Clinic must have relationship with pet owner

4. **Data Persistence**
   - Tag ID recorded in database for tracking
   - Can disable tag without physical destruction

## Error Handling

### NFC Hardware Issues
- Service checks for hardware on startup
- Graceful degradation if no reader available
- Clear error messages to users

### Write Failures
- Timeout if no tag detected (60 seconds)
- Write validation after each block
- Retry logic available

### Tag Reading Issues
- Multiple parsing methods (NDEF, raw hex, ASCII)
- Fallback mechanisms for different tag types
- Automatic format detection

## Future Enhancements

1. **Multiple NFC Tags**
   - Track multiple tags per pet
   - Enable/disable specific tags
   - Log tag usage history

2. **Advanced NDEF Records**
   - Store additional data (vet contact, vaccines)
   - Text records with medical brief
   - Contact record for owner info

3. **NFC Event Logging**
   - Track when tags are scanned
   - Geolocation data if permitted
   - Notification on unknown scanner

4. **RFID Integration**
   - Support for RFID tags
   - Chip ID reading without NDEF
   - Vet microchip number linking
