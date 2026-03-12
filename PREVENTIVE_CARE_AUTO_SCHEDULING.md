# Preventive Care Auto-Scheduling Implementation

## Overview

This implementation adds automatic next-due-date calculation for preventive care services during post-procedure notes. The system works similar to vaccine scheduling:

1. **Preventive care services** (Deworming, Flea and Tick Prevention, Rabies Vaccine) are defined with default intervals
2. **When a vet administers preventive care**, the next due date is **auto-calculated** based on the date administered + the service's default interval
3. **Vets can override** the auto-calculated date if needed
4. The modified next due date then gets scheduled for the pet

## Default Intervals

| Service | Interval | Description |
|---------|----------|-------------|
| Deworming | 90 days | Internal parasite treatment |
| Flea and Tick Prevention | 30 days | Monthly preventive treatment |

**Note:** Rabies Vaccine is handled via the **vaccine form** (Step 3 for vaccination appointments), not as a preventive care item. Use the Vaccine section for rabies vaccinations (365-day interval with booster scheduling).

## Setup Instructions

### Step 1: Update Database Schema

The `ProductService` model has been updated to include an optional `intervalDays` field:

```typescript
intervalDays?: number; // For preventive care services, days until next due
```

### Step 2: Seed Preventive Care Services

Run the seed script to create/update the preventive care services with default intervals:

```bash
cd backend
npx ts-node scripts/seedPreventiveCareServices.ts
```

**Output:**
```
✓ Connected to MongoDB
✓ Created "Deworming" with intervalDays: 90 days
✓ Created "Flea and Tick Prevention" with intervalDays: 30 days

✓ Preventive care services seeded successfully!
  - Deworming: 90-day interval
  - Flea and Tick Prevention: 30-day interval
  - Note: Rabies Vaccine is handled via the vaccine form (VaccineType)
```

### Step 3: Restart Services

Rebuild the backend and restart both frontend and backend services:

```bash
# Backend
cd backend
npm run build
npm start

# Frontend (in another terminal)
cd frontend
npm run dev
```

## How It Works

### In the Medical Record Modal - Post-Procedure Tab

When a vet is filling out post-procedure notes with preventive care:

1. **Select a preventive care service** → The interval is shown in the dropdown (e.g., "[90d]")
2. **Enter date administered** → The system auto-calculates the next due date
3. **Review the suggested date** → Displayed in a blue box labeled "Suggested Next Due Date"
4. **Override if needed** → Vet can modify the date in the override field
5. **Save** → The preventive care record is saved with the next due date

### For Vaccines (Including Rabies)

Vaccines like **Rabies Vaccine** are handled separately through the **vaccine form**:
- Appears as **Step 3** for vaccination appointments
- Auto-calculates next due date based on `validityDays` and `boosterIntervalDays` from VaccineType
- Displays expiry date and booster schedule with override capability
- Vet can still manually edit the next due date if needed

See Step 3 section to understand how the vaccine form works during the appointment.

## Why Rabies Vaccine is Not in Preventive Care

**Rabies Vaccine** is a **vaccine**, not a preventive care service. It's handled through the **VaccineType** model instead:

- **VaccineTypes** have more complex scheduling with boosters and age requirements
- **Vaccines** can have multiple booster intervals and lifetime immunity options
- **Preventive Care** is for recurring treatments like deworming and flea/tick prevention

**When to use each form:**
- **Vaccine Form (Step 3)**: Rabies, DHPPiL, etc. - vaccinations with booster schedules
- **Preventive Care Form (Post-Procedure)**: Deworming, Flea and Tick Prevention - recurring treatments

## Frontend Changes

### Updated Components

**MedicalRecordStagedModal.tsx:**
- Preventive care form now shows interval in service dropdown
- When `dateAdministered` is set or product is selected, `nextDueDate` is auto-calculated
- Calculated date is displayed in a blue suggestion box
- Vet can override with a manual date in the input field

### Updated Libraries

**lib/medicalRecords.ts:**
- `ProductService` interface now includes optional `intervalDays` field
- This field is passed from backend to frontend automatically

## Backend Changes

### Updated Models

**ProductService.ts:**
- New optional field: `intervalDays: number` (minimum 1 day)
- Used only for preventive care category services
- Stored in database but not required

### Example Data

After running the seed script, preventive care services have:

```javascript
{
  name: "Deworming",
  category: "Preventive Care",
  type: "Service",
  price: 250,
  intervalDays: 90,
  isActive: true
},
{
  name: "Flea and Tick Prevention",
  category: "Preventive Care",
  type: "Service",
  price: 350,
  intervalDays: 30,
  isActive: true
}
```

For Rabies Vaccine, see the `VaccineType` model which handles it with booster scheduling.

## Testing

### Test Scenario

1. **Go to Animal's Medical Record → Post-Procedure**
2. **Add Preventive Care Item**
   - Select "Flea and Tick Prevention" from dropdown
   - Set Date Administered to March 10, 2026
   - System auto-calculates: April 9, 2026 (30 days later)
3. **Override if desired**
   - Change Next Due Date to April 20, 2026 if needed
4. **Save**
   - Both dates are persisted

### Manual Database Check

```bash
# Connect to MongoDB and check a pet's medical record
db.medicalrecords.findOne(
  { "preventiveCare.product": "Flea and Tick Prevention" },
  { "preventiveCare.$": 1 }
)

# Should show:
# {
#   "preventiveCare": [{
#     "product": "Flea and Tick Prevention",
#     "dateAdministered": "2026-03-10",
#     "nextDueDate": "2026-04-09",
#     "careType": "other"
#   }]
# }
```

## Future Enhancements

1. **Auto-Schedule Appointments**: When preventive care is saved, automatically create a reminder/appointment for the next due date
2. **Calendar Integration**: Display preventive care due dates on the vaccine calendar
3. **Custom Intervals**: Allow clinics to customize intervals per service
4. **Reminders**: Notify vets when preventive care is due
5. **Recurring Services**: Option to mark as recurring vs one-time

## Troubleshooting

### Services Not Showing Intervals

1. Verify the seed script was run: `npx ts-node scripts/seedPreventiveCareServices.ts`
2. Check MongoDB that services have `intervalDays` field
3. Restart the backend service to refresh the API

### Auto-Calculation Not Working

1. Ensure `dateAdministered` is filled in first
2. Verify the selected service exists in `preventiveCareServices` array
3. Check browser console for any errors
4. Verify the service has `intervalDays` > 0

### Next Due Date Not Saving

1. Ensure you fill in both `product` and `dateAdministered`
2. Save the medical record before closing
3. Check the "Next Due Date (Optional - Override)" field is visible
4. Reload the page and verify the date was persisted

## Code References

- Backend Model: `backend/src/models/ProductService.ts`
- Seed Script: `backend/scripts/seedPreventiveCareServices.ts`
- Frontend Form: `frontend/components/MedicalRecordStagedModal.tsx` (lines 1562+)
- Types: `frontend/lib/medicalRecords.ts`
