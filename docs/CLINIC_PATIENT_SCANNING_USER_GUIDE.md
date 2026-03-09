# Quick Guide: Scanning Pet Tags & QR Codes on Patients Page

## Overview
Clinic staff can now quickly open patient profiles by scanning either an **NFC pet tag** or a **QR code** directly from the Patients page.

## Location
The scanning buttons are located on the **Clinic Admin → Patients** page, **directly under the search bar**:

```
[ Search Patients _________________________ ]

[ Scan Pet Tag ]   [ Scan QR Code ]

────────────────────────────────────────────
(List of Patients)
```

## Method 1: Scanning NFC Pet Tags

### What You'll Need
- A compatible NFC pet tag (MIFARE or NTAG type)
- An NFC reader (USB reader on desktop or mobile device with NFC)

### Steps
1. Go to **Clinic Admin → Patients** page
2. Click the **blue "Scan Pet Tag"** button
3. A modal window will appear with instructions: **"Tap the pet tag on the NFC reader"**
4. **Tap** the pet tag on your NFC reader or hold it to your mobile device (if using phone NFC)
5. Wait 1-3 seconds for the tag to be read
6. The system will automatically open the pet's profile

### Success
✅ **When successful:**
- Green checkmark appears: "Pet found! Opening profile..."
- Patient drawer opens showing the pet's full profile
- You can now view medical records, vaccines, etc.

### Troubleshooting
❌ **If it doesn't work:**
1. **"No NFC tag detected"** → Try tapping the tag again or hold it closer
2. **"Pet tag not recognized"** → The tag may not have valid pet data
3. **"NFC reader not available"** → Try QR code instead or check your NFC reader connection

💡 **Tip:** Click **"Retry"** button to try scanning again

---

## Method 2: Scanning QR Codes

### What You'll Need
- A mobile device with a camera (any smartphone or tablet)
- A QR code on/near the patient's file or physical tag

### Steps
1. Go to **Clinic Admin → Patients** page
2. Click the **"Scan QR Code"** button
3. A camera window will appear with instructions: **"Align the QR code within the camera frame"**
4. **Point your camera** at the QR code
5. Wait for the QR code to be detected (usually 1-2 seconds)
6. The system will automatically open the pet's profile

### Success
✅ **When successful:**
- Green checkmark appears: "Pet found! Opening profile..."
- Patient drawer opens showing the pet's full profile
- You can now view medical records, vaccines, etc.

### Troubleshooting
❌ **If it doesn't work:**
1. **"QR code could not be read"** → Try adjusting lighting or cleaning camera
2. **"No pet found for this QR code"** → The QR code may be invalid or outdated
3. **Camera permission denied** → Allow camera access in browser settings

💡 **Tips:**
- Ensure good lighting
- Keep QR code in the center of the camera frame
- QR code should be clean and not damaged

---

## What Happens After Scanning

### Patient Profile Opens in a Drawer
The patient profile displays:
- 📸 Pet photo (or placeholder icon)
- 📋 **Overview Tab**: Pet info (species, breed, age, weight, microchip)
- 💉 **Vaccine Tab**: Vaccination records and cards
- 📊 **Medical Tab**: Medical records and history
- 💊 **Medications Tab**: Current medications
- 📁 **Files Tab**: Images and supporting documents

### Available Actions
From the patient profile drawer, you can:
- ✏️ **Edit Patient** - Update pet information
- 🖨️ **Print** - Print medical records
- 📤 **Share** - Share patient info
- 📑 **View Records** - Access full medical history

---

## Closing the Profile

Click the **X button** in the top right of the patient profile drawer to close it and return to the full patients list.

---

## Common Scenarios

### Scenario 1: Staff Member Needs Quick Access to Patient
**Situation:** Clinic staff walks by a pet with a NFC tag and needs to quickly pull up its records.

**Solution:**
1. Click "Scan Pet Tag"
2. Tap the tag on NFC reader
3. Patient profile opens instantly
4. Review records in seconds

### Scenario 2: Customer Has Pet QR Code
**Situation:** A pet owner has a QR code printed on their pet's ID card or tag.

**Solution:**
1. Click "Scan QR Code"
2. Scan the customer's QR code
3. Patient profile opens
4. Share relevant information with customer

### Scenario 3: Wrong Pet Scanned
**Situation:** Multiple pets are being processed and a wrong tag was scanned.

**Solution:**
1. Close the current patient drawer (click X)
2. Click "Scan Pet Tag" or "Scan QR Code" again
3. Scan the correct pet
4. Continue with correct patient

---

## Tips for Best Results

✅ **DO:**
- Keep NFC reader/camera clean
- Ensure adequate lighting for QR scans
- Hold NFC tag perpendicular to reader
- Frame QR code in center of camera
- Allow sufficient time for scan to complete (3-5 seconds)

❌ **DON'T:**
- Move the NFC tag away during scanning
- Scan damaged or faded QR codes
- Cover the NFC reader with metal objects
- Deny camera permissions when prompted
- Scan too quickly (wait for success confirmation)

---

## Troubleshooting Reference

| Problem | Solution |
|---------|----------|
| NFC scan times out | Try again, hold tag closer |
| QR code won't scan | Improve lighting, clean camera lens |
| Pet not found | Check tag/QR contains valid pet data |
| Camera permission denied | Enable camera in browser settings |
| Wrong pet opened | Close drawer and scan correct tag |
| Scanning buttons not visible | Refresh page, ensure logged in as clinic admin |

---

## Need Help?

If you're having issues with scanning:

1. **Check browser compatibility** - Use Chrome, Edge, Firefox, or Safari
2. **Ensure permissions** - Allow camera and NFC access
3. **Verify pet data** - Confirm pet exists in the system
4. **Contact IT support** - If NFC reader is not detected
5. **Reset scanner** - Refresh the page and try again

---

**Questions?** Contact your clinic administrator or IT support team.

**Last Updated:** March 9, 2026
