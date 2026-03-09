# Vaccine Type Setup - Complete Guide

This guide explains how to populate vaccine types in the database. The validation system **depends entirely** on accurate vaccine type configuration, so getting this right is critical.

## Quick Start - Automated Setup

### Option 1: Use the Seed Script (Recommended)

```bash
# Install if needed
cd backend
npm install

# Run seeding script
npx ts-node scripts/seedVaccines.ts
```

This creates:
- **14 canine vaccines** (puppy series, adult boosters, kennel cough, leptospirosis)
- **10 feline vaccines** (kitten series, adult boosters)
- All with proper age ranges (min/max months)

**Output:**
```
✅ Connected to MongoDB
📝 Inserting canine vaccines...
✅ Created 14 canine vaccine types
📝 Inserting feline vaccines...
✅ Created 10 feline vaccine types

📊 Seeding Summary:
   • Canine vaccines: 14
   • Feline vaccines: 10
   • Total: 24

✨ Seeding complete!
```

### Option 2: Clear & Reseed (Fresh Start)

```bash
npx ts-node scripts/seedVaccines.ts --force
```

This overwrites any existing vaccines (use with caution!).

## Manual Setup - Clinic Admin Panel

If you prefer to set up vaccines manually:

### Access Vaccine Type Management

1. **Vet Dashboard**: `http://localhost:3000/vet-dashboard/vaccinations` → Vaccine Types tab
2. **Clinic Admin**: `http://localhost:3000/clinic-admin/vaccine-types`

### Creating a Vaccine Type

Click **+ Add New Vaccine**

| Field | Example | Notes |
|---|---|---|
| **Vaccine Name** | "DHPPiL (1st - 6 weeks)" | Be specific about dose number |
| **Species** | Dog | Keep separate from cat vaccines |
| **Validity (days)** | 365 | How long vaccine lasts |
| **Min Age (months)** | 1.5 | Earliest age for this vaccine |
| **Max Age (months)** | 6 | Latest age (optional - leave empty for no max) |
| **Requires Booster** | Yes | If needs follow-up shot |
| **Booster Interval** | 21 | Days until next dose |
| **Route** | Intramuscular (IM) | How vaccine is administered |
| **Manufacturer** | Zoetis | Default when creating records |
| **Batch Number** | (optional) | Auto-fill in vaccination records |

### Save Changes

Click **Save Changes** button

---

## Vaccine Type Configurations Reference

### Canine (Dog) - Puppy Series

These should be created in order:

#### 1️⃣ DHPPiL (1st - 6 weeks)
```
Vaccine Name: DHPPiL (1st dose - 6 weeks)
Species: Dog
Validity: 365 days
Min Age: 1.5 months
Max Age: 6 months
Requires Booster: YES
Booster Interval: 21 days
Route: Intramuscular
Manufacturer: Zoetis
Price: $45
```

#### 2️⃣ DHPPiL (2nd - 8-9 weeks)
```
Vaccine Name: DHPPiL (2nd dose - 8-9 weeks)
Species: Dog
Validity: 365 days
Min Age: 2 months
Max Age: 8 months
Requires Booster: YES
Booster Interval: 21 days
Route: Intramuscular
Manufacturer: Zoetis
Price: $45
```

#### 3️⃣ DHPPiL (3rd - 12 weeks)
```
Vaccine Name: DHPPiL (3rd dose - 12 weeks)
Species: Dog
Validity: 365 days
Min Age: 3 months
Max Age: 10 months
Requires Booster: YES
Booster Interval: 21 days
Route: Intramuscular
Manufacturer: Zoetis
Price: $45
```

#### 4️⃣ DHPPiL (Final - 16 weeks)
```
Vaccine Name: DHPPiL (Final - 16 weeks)
Species: Dog
Validity: 365 days
Min Age: 4 months
Max Age: 12 months
Requires Booster: YES
Booster Interval: 1095 days (3 years)
Route: Intramuscular
Manufacturer: Zoetis
Price: $50
```

### Canine - First Rabies

#### 5️⃣ Rabies (Initial)
```
Vaccine Name: Rabies (Initial - puppy)
Species: Dog
Validity: 365 days
Min Age: 4 months
Max Age: 16 months
Requires Booster: YES
Booster Interval: 365 days
Route: Intramuscular
Manufacturer: Merck
Price: $35
```

### Canine - Adult Boosters

These are for dogs 12+ months old and have NO maximum age.

#### 6️⃣ DHPPiL Booster (Adult)
```
Vaccine Name: DHPPiL Booster (Adult)
Species: Dog
Validity: 1095 days (3 years)
Min Age: 12 months
Max Age: [LEAVE EMPTY]
Requires Booster: YES
Booster Interval: 1095 days
Route: Intramuscular
Manufacturer: Zoetis
Price: $50
```

#### 7️⃣ Rabies Booster (Annual)
```
Vaccine Name: Rabies Booster (Annual)
Species: Dog
Validity: 365 days
Min Age: 12 months
Max Age: [LEAVE EMPTY]
Requires Booster: YES
Booster Interval: 365 days
Route: Intramuscular
Manufacturer: Merck
Price: $40
```

### Canine - Specialty Vaccines

#### 8️⃣ Bordetella (Kennel Cough)
```
Vaccine Name: Bordetella (Kennel Cough - 8-9 weeks)
Species: Dog
Validity: 365 days
Min Age: 2 months
Max Age: [LEAVE EMPTY]
Requires Booster: YES
Booster Interval: 365 days
Route: Oral
Manufacturer: Merck
Price: $30
```

#### 9️⃣ Leptospirosis (High-Risk)
```
Vaccine Name: Leptospirosis (HIGH-RISK - 6-month booster)
Species: Dog
Validity: 180 days
Min Age: 3 months
Max Age: [LEAVE EMPTY]
Requires Booster: YES
Booster Interval: 180 days
Route: Intramuscular
Manufacturer: Zoetis
Price: $25
```

---

## Feline (Cat) - Kitten Series

#### DHPPi (1st - 6-8 weeks)
```
Vaccine Name: FVRCP (1st dose - 6-8 weeks)
Species: Cat
Validity: 365 days
Min Age: 1.5 months
Max Age: 4 months
Requires Booster: YES
Booster Interval: 21 days
Route: Intramuscular
Manufacturer: Merck
Price: $40
```

#### FVRCP (2nd - 10-12 weeks)
```
Vaccine Name: FVRCP (2nd dose - 10-12 weeks)
Species: Cat
Validity: 365 days
Min Age: 2.5 months
Max Age: 6 months
Requires Booster: YES
Booster Interval: 21 days
Route: Intramuscular
Manufacturer: Merck
Price: $40
```

#### FVRCP (Final - 14-16 weeks)
```
Vaccine Name: FVRCP (Final - 14-16 weeks)
Species: Cat
Validity: 365 days
Min Age: 3.5 months
Max Age: 8 months
Requires Booster: YES
Booster Interval: 1095 days (3 years)
Route: Intramuscular
Manufacturer: Merck
Price: $45
```

#### Rabies (Initial)
```
Vaccine Name: Rabies (Initial - kitten)
Species: Cat
Validity: 365 days
Min Age: 4 months
Max Age: 16 months
Requires Booster: YES
Booster Interval: 365 days
Route: Intramuscular
Manufacturer: Merck
Price: $35
```

#### FVRCP Booster (Adult)
```
Vaccine Name: FVRCP Booster (Adult - 3 year)
Species: Cat
Validity: 1095 days
Min Age: 12 months
Max Age: [LEAVE EMPTY]
Requires Booster: YES
Booster Interval: 1095 days
Route: Intramuscular
Manufacturer: Merck
Price: $45
```

#### Rabies Booster (Annual)
```
Vaccine Name: Rabies Booster (Annual)
Species: Cat
Validity: 365 days
Min Age: 12 months
Max Age: [LEAVE EMPTY]
Requires Booster: YES
Booster Interval: 365 days
Route: Intramuscular
Manufacturer: Merck
Price: $40
```

---

## Testing Your Configuration

After setting up vaccine types, test the validation:

### Test 1: Puppy Too Young ✅
1. Open clinic admin vaccination form
2. Select a 2-month-old puppy
3. Select "DHPPiL (Final - 16 weeks)"
4. **Expected**: Amber warning: "Pet is 2 months old. Not yet eligible for DHPPiL (requires 4 months) - in 8 weeks"

### Test 2: Puppy Eligible ✅
1. Select a 4-month-old puppy
2. Select "DHPPiL (Final - 16 weeks)"
3. **Expected**: Green checkmark: "Pet is 4 months old - eligible for DHPPiL (Final)"

### Test 3: Adult Too Old for Puppy Vaccine ✅
1. Select a 3-year-old dog
2. Select "DHPPiL (1st dose - 6 weeks)"
3. **Expected**: Amber warning: "Pet is 3 years old. Too old for DHPPiL (recommended age: 1.5-6 months)"

### Test 4: Adult Eligible for Booster ✅
1. Select a 3-year-old dog
2. Select "DHPPiL Booster (Adult)"
3. **Expected**: Green checkmark: "Pet is 3 years old - eligible for DHPPiL Booster"

---

## Important Notes

### ⚠️ Min/Max Age are Critical
- The entire validation system depends on these values being correct
- If min age is wrong, puppies might be vaccinated too early and get no immunity
- If max age is missing on puppy vaccines, adult dogs could accidentally receive wrong formulations

### 📝 Naming Conventions
Use consistent naming so staff knows which dose they're giving:
- ✅ Good: "DHPPiL (1st - 6 weeks)", "DHPPiL (2nd - 9 weeks)"
- ❌ Bad: "DHPPiL", "Vaccine 1"

### 🔄 Update Existing Records
After changing vaccine type settings, previously created vaccinations still reference the old values. Consider:
- Backing up old data
- Documenting what changed
- Re-recording if ages were significantly wrong

### 💾 Backup Before Bulk Operations
```bash
# Export vaccines
mongoexport --db pawsync --collection vaccinetypes --out vaccines_backup.json

# Import if needed
mongoimport --db pawsync --collection vaccinetypes vaccines_backup.json
```

---

## Troubleshooting

**Q: I created vaccines but validation shows no warnings**  
A: Check that minAgeMonths and maxAgeMonths are set. Leave maxAgeMonths empty for no limit.

**Q: "Too old" warnings appear for adult dogs getting adult vaccines**  
A: Make sure adult vaccines have EMPTY maxAgeMonths field (not a number).

**Q: Can I have multiple DHPPiL vaccines?**  
A: Yes! Create separate ones:
- DHPPiL (1st) - min 1.5, max 6
- DHPPiL (2nd) - min 2, max 8
- DHPPiL (Final) - min 4, max 12
- DHPPiL Booster - min 12, max [empty]

**Q: Staff keeps vaccinating too-young puppies**  
A: This means your min/max ages aren't set correctly on the vaccine type. Verify in vaccine type management.

---

## API Response Format

When fetching vaccine types, the API returns:

```json
{
  "status": "SUCCESS",
  "data": {
    "vaccineTypes": [
      {
        "_id": "objectId",
        "name": "DHPPiL (1st - 6 weeks)",
        "species": ["dog"],
        "validityDays": 365,
        "requiresBooster": true,
        "boosterIntervalDays": 21,
        "minAgeMonths": 1.5,
        "maxAgeMonths": 6,
        "route": "intramuscular",
        "pricePerDose": 45,
        "defaultManufacturer": "Zoetis",
        "defaultBatchNumber": null,
        "isActive": true,
        "createdAt": "2026-03-09T...",
        "updatedAt": "2026-03-09T..."
      }
    ]
  }
}
```

The validation system uses `minAgeMonths` and `maxAgeMonths` for age checking.

---

## Support

For questions about:
- **Minimum ages**: See VACCINE_SETUP_GUIDE.md
- **Max ages**: See MAX_AGE_VACCINATION_FEATURE.md
- **Validation logic**: See VACCINATION_AGE_VALIDATION_README.md
- **Test cases**: See VACCINATION_AGE_VALIDATION_TESTS.md
