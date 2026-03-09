# Technical Specifications: NFC Tags & QR Codes for Patient Scanning

## Overview
This document provides technical specifications for creating NFC tags and QR codes that work with the Clinic Patient Scanning feature.

---

## NFC Tag Specifications

### Compatible Tag Types
- **MIFARE Classic** (1K or 4K)
- **MIFARE Ultralight** (NTAG series)
- **ISO/IEC 14443A** compliant cards
- **ISO/IEC 14443B** compliant cards

### Minimum Requirements
- **Capacity**: At least 64 bytes of user-writable memory
- **Format**: NDEF URI record
- **Content**: Pet ID or microchip number

### Encoding Format
NFC tags store data in **NDEF (NFC Data Exchange Format)**:

```
NDEF Message:
├── Record Type: URI
├── URI Scheme: https:// or http://
└── Content: https://app.com/pet/{PET_ID}
```

### Data Content Examples

#### Option 1: Full URL (Recommended)
```
https://your-app.com/pet/507f1f77bcf86cd799439011
```
- More human-readable if manually scanned
- Works with both clinic and public scanning
- **Pet ID**: `507f1f77bcf86cd799439011` (MongoDB ObjectId)

#### Option 2: Direct Pet ID
```
507f1f77bcf86cd799439011
```
- Clinic system searches for matching pet
- More compact storage
- Works only with clinic scanning system

#### Option 3: Microchip Number
```
985121000000789
```
- Uses existing microchip identifier
- Useful if pet already has microchip
- Must add microchip number to pet record

### Physical Tag Recommendations

| Type | Size | Durability | Cost |
|------|------|------------|------|
| NTAG216 | Card (85×54mm) | High | Low |
| NTAG424 | Card (85×54mm) | High | Medium |
| MIFARE Classic | Card (85×54mm) | High | Low |
| Sticker Tag | Small (25mm) | Medium | Low |
| Wristband | Adjustable | High | Medium |
| Pet Collar Tag | Metal | Very High | High |

### Writing NFC Tags

**Use Case**: Veterinary clinic staff writing tags from the NFC management page.

**Process**:
1. Select pet from clinic dashboard
2. Click "Write NFC Tag"
3. Place blank NFC tag on USB reader
4. System automatically encodes pet profile URL
5. Tag UID is recorded in database

**Backend Endpoint**:
```bash
POST /api/nfc/pet/{petId}/write
Authorization: Bearer <clinic-token>
Content-Type: application/json

Request:
{
  "url": "https://app.com/pet/507f1f77bcf86cd799439011"
}

Response:
{
  "success": true,
  "message": "Tag written successfully",
  "tagUid": "04a1b2c3d4e5f6g7",
  "petId": "507f1f77bcf86cd799439011"
}
```

### Tag Lifecycle

```
1. CREATE
   └─ Blank NFC tag purchased from supplier

2. WRITE
   └─ Load pet profile URL from clinic dashboard
   └─ Tag UID recorded in database: pet.nfcTagId

3. DISTRIBUTE
   └─ Attach to pet collar or ID tag
   └─ Give to pet owner or keep at clinic

4. USE
   └─ Clinic staff scans tag on Patients page
   └─ Patient profile opens instantly
   └─ Anyone with device can scan (public page)

5. RETIRE/REWRITE
   └─ Erase old data if reassigning tag
   └─ Rewrite with new pet information
   └─ Update database with new pet.nfcTagId
```

---

## QR Code Specifications

### QR Code Standards
- **ISO/IEC 18004** standard
- **Version**: Any (automatically scales with content)
- **Error Correction**: High (30% recovery)
- **Format**: PNG, JPEG, or SVG

### Data Content

#### Option 1: Full URL (Recommended & Default)
```
https://your-app.com/pet/507f1f77bcf86cd799439011
```

**Characteristics**:
- Automatically generated when pet is created
- Stored as PNG image in database
- Scannable by any QR code reader
- Works with both clinic and public scanning
- Compatible with mobile phones

**Example Response from API**:
```json
{
  "status": "SUCCESS",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Buddy",
    "qrCode": "data:image/png;base64,iVBORw0KGGo..."
  }
}
```

#### Option 2: Direct Pet ID
```
507f1f77bcf86cd799439011
```

- More compact
- Requires clinic system to process
- Less useful for public scanning

#### Option 3: Microchip Number
```
985121000000789
```

- Existing pet identifier
- Can be manually entered
- Alternative when URL unavailable

### QR Code Generation

**Backend generates automatically on pet creation**:

```typescript
// From backend/src/controllers/petController.ts
const qrCode = QRCode.toDataURL(
  `https://app.com/pet/${pet._id}`,
  { errorCorrectionLevel: 'H', width: 200 }
);
pet.qrCode = qrCode;
```

### QR Code Uses

#### 1. Print on Physical Tags
```
[====== BUDDY ======]
[  |  QR CODE  |   ]
[  |           |   ]
[  |___________|   ]
Scan for pet info
```

#### 2. Send via Email
```
Dear Pet Owner,

Attached is your pet's QR code.
You can share it with others to let them
access your pet's information in case your
pet is lost.
```

#### 3. Display in Medical Records
```
┌─────────────────────┐
│ Medical Record      │
│ Buddy (Dog)         │
│ [QR CODE]           │
│ Scan to update info │
└─────────────────────┘
```

#### 4. Store in Digital Pet Profile
```
Pet Profile Page
├── Photo
├── Basic Info
├── Medical Records
├── QR Code (printable)
└── Share Options
```

### QR Code Size Recommendations

| Use Case | Size | Notes |
|----------|------|-------|
| Email attachment | 200×200 px | Screen viewing |
| Print on label | 2×2 inches | Standard label |
| Collar tag | 1×1 inch | Wearable |
| Certificate | 3×3 inches | Medical record |
| Website | 150×150 px | Web display |

### Scanning QR Codes

**Device Requirements**:
- Smartphone with camera
- Any QR code reader app (or built-in scanner)
- Internet connection

**Supported Formats**:
- Static URLs (no expiration)
- Dynamic URLs (if infrastructure supports)
- Plain text pet IDs
- Microchip numbers

---

## Database Integration

### Pet Model Fields

```typescript
interface Pet {
  _id: ObjectId;              // Primary pet ID
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  
  // Scanning identifiers
  qrCode: string;             // QR code PNG data URL
  nfcTagId?: string;          // NFC tag UID (optional)
  microchipNumber?: string;   // Microchip identifier
  
  // Other fields...
}
```

### Query for Scanning

**In clinic patients page**:
```javascript
// User scans tag/QR with ID: "507f1f77bcf86cd799439011"
const pet = patients.find(p => 
  p._id === scannedId || 
  p.microchipNumber === scannedId
);
```

---

## Implementation Checklist

### For IT/DevOps
- [ ] Backend NFC service running (if using USB reader)
- [ ] WebSocket server enabled for real-time NFC events
- [ ] QR code generation enabled on pet creation
- [ ] Database stores qrCode field on Pet model
- [ ] Pet _id field exposed in clinic API responses

### For Clinic Staff
- [ ] Obtain compatible NFC tags or use existing microchips
- [ ] Print or distribute QR codes to pet owners
- [ ] Test NFC tag writing (if enabled)
- [ ] Test scanning with test pets
- [ ] Familiarize staff with scanning buttons location

### For Pet Owners
- [ ] Receive QR code/NFC tag with pet
- [ ] Attach tag to pet collar
- [ ] Register tag with clinic
- [ ] Distribute copies to trusted contacts
- [ ] Update microchip information if changed

---

## Security Considerations

### NFC Tag Security
- **Read-Only**: Tags should be configured as read-only to prevent tampering
- **Location**: Store URL, not sensitive medical data
- **Encryption**: Consider NDEF encryption for sensitive scans
- **Access**: Any person with device can scan (design for this)

### QR Code Security
- **Public By Design**: QR codes point to public or semi-public URLs
- **No Sensitive Data**: Don't embed passwords or private keys
- **URL Verification**: Verify QR points to legitimate domain
- **Rate Limiting**: Implement rate limiting on public pet profile endpoints

### Data Privacy
- **Minimal Exposure**: Only show shareable pet information
- **Owner Consent**: QR codes given only with owner permission
- **Contact Control**: Owners can control contact info visibility
- **Medical Privacy**: Keep medical records behind authentication

---

## Troubleshooting Reference

### NFC Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Tag not detected | Wrong tag type | Use MIFARE/NTAG tags |
| Invalid format | Not NDEF encoded | Rewrite using NFC writer |
| UID mismatch | Tag UID not recorded | Update pet.nfcTagId in DB |
| Write fails | Tag is read-only | Use blank or erasable tags |

### QR Code Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Won't scan | QR is damaged | Regenerate and print new |
| Wrong pet opens | Stale QR code | Verify QR contains current pet ID |
| Can't generate | API error | Check backend logs |
| Print quality low | Low resolution | Use at least 200×200 px |

---

## Example Workflow

### Complete Setup Process

```
1. PET CREATED
   └─ Backend auto-generates QR code
   └─ QR stored in database: pet.qrCode
   └─ Pet ID: "507f1f77bcf86cd799439011"

2. QR CODE DISTRIBUTED
   └─ Print QR on client invoice
   └─ Email QR to pet owner
   └─ Attach QR to pet record

3. NFC TAG OPTIONAL
   └─ Clinic staff selects pet in NFC page
   └─ Writes pet profile URL to blank tag:
      "https://app.com/pet/507f1f77bcf86cd799439011"
   └─ Tag UID recorded: "04a1b2c3d4e5f6g7"
   └─ Pet owner attaches to collar

4. SCANNING AT CLINIC
   └─ Staff scans tag/QR on Patients page
   └─ System finds matching pet by ID
   └─ Patient profile opens instantly
   └─ Staff can review medical history

5. PUBLIC SCANNING
   └─ Anyone (with phone) scans QR code
   └─ Public pet profile opens
   └─ Shows shareable pet info
   └─ Can contact owner if pet is lost
```

---

## References & Best Practices

- **NDEF Specification**: https://nfcpy.readthedocs.io/en/latest/
- **QR Code Standards**: ISO/IEC 18004:2015
- **NFC Forum Specifications**: https://nfcforum.org/
- **Security Guidelines**: NIST SP 800-175B (NFC Security)

---

**Last Updated:** March 9, 2026  
**Version:** 1.0  
**Status:** Production Ready
