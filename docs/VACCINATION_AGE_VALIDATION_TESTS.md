## Testing Vaccination Age Validation

This document provides test cases to verify the age-based vaccine validation is working correctly.

### Test Scenario 1: Puppy Too Young for Final Rabies

**Setup:**
- Create or use a puppy with DOB = today - 8 weeks
- Open clinic admin vaccination form
- Select the puppy
- Select vaccine type: "DHPPiL + Rabies (Final)" with minAgeMonths = 4

**Expected Result:**
- ✅ Show AMBER warning message
- ✅ Message says "Pet is 2 months old... requires 4 months... in about 8 weeks"
- ✅ Minimum age requirement is clearly stated
- ✅ Allow proceeding (for cases where age can be verified elsewhere)

### Test Scenario 2: Puppy Eligible for Current Dose

**Setup:**
- Create or use a puppy with DOB = today - 12 weeks
- Open clinic admin vaccination form
- Select the puppy
- Select vaccine type: "DHPPiL (3rd dose)" with minAgeMonths = 3

**Expected Result:**
- ✅ Show GREEN checkmark message
- ✅ Message says "Pet is 3 months old - eligible for DHPPiL (3rd dose)"
- ✅ Clear indication that vaccination is appropriate
- ✅ "Pet meets the minimum age requirement" note

### Test Scenario 3: Age at Boundary (Exactly Minimum)

**Setup:**
- Create puppy with DOB = exactly 4 months ago (to the day)
- Select Rabies vaccine requiring 4 months

**Expected Result:**
- ✅ Show GREEN checkmark (age >= minAgeMonths)
- ✅ Display "Pet is 4 months old - eligible"

### Test Scenario 4: Kitten Vaccination Schedule

**Setup:**
- Create kitten with DOB = today - 6 weeks
- Select FVRCP (1st dose) with minAgeMonths = 1.5

**Expected Result:**
- ✅ Show GREEN checkmark
- ✅ Message includes "FVRCP"
- ✅ Kitten is eligible for first core vaccination

### Test Scenario 5: Multi-Pet Household

**Setup:**
- Create owner with 2 puppies (DOB = 8 weeks ago, 4 weeks ago)
- Open vaccination form
- Select first puppy (8 weeks old)
- Choose DHPPiL 2nd dose (2 months)

**Expected Result:**
- ✅ Show GREEN checkmark for 8-week-old puppy
- ✅ Switch to 4-week-old puppy
- ✅ Show AMBER warning for same vaccine (not yet eligible)
- ✅ System correctly tracks each pet separately

### Test Scenario 6: Newborn Pet

**Setup:**
- Create puppy with DOB = today
- Select any vaccine with standard minAgeMonths = 1.5

**Expected Result:**
- ✅ Show AMBER warning
- ✅ Message says "Pet is Newborn... requires 1.5 months... in about 4 weeks"
- ✅ Days/weeks calculation is reasonable

### Test Scenario 7: Adult Dog Booster

**Setup:**
- Create adult dog with DOB = 2 years ago
- Select "Rabies Booster" with minAgeMonths = 12

**Expected Result:**
- ✅ Show GREEN checkmark
- ✅ "Pet is 2 years old - eligible" message
- ✅ Works correctly for adult pets

### Test Scenario 8: Missing Date of Birth

**Setup:**
- Create pet WITHOUT dateOfBirth set
- Open vaccination form
- Select pet
- Select vaccine

**Expected Result:**
- ✅ No age eligibility message displayed (graceful degradation)
- ✅ Form still allows saving vaccination
- ✅ No errors in console

### Validation Rules to Check

- [ ] Age in months calculated correctly from DOB
- [ ] Eligible status is boolean (true/false)
- [ ] Message updates immediately when vaccine changes
- [ ] Message updates immediately when pet changes
- [ ] Age formatting works for weeks, months, years
- [ ] Days until eligible calculated correctly
- [ ] Boundary cases handled (exactly at minimum age)
- [ ] Form allows saving even with warning (safety override for edge cases)

### Manual Testing Commands

If you want to test with specific dates, calculate backwards from today:

- **Exactly 6 weeks old**: today - 42 days
- **Exactly 8 weeks old**: today - 56 days
- **Exactly 12 weeks old**: today - 84 days
- **Exactly 4 months old**: today - 120 days
- **Exactly 6 months old**: today - 180 days
- **Exactly 1 year old**: today - 365 days

### Browser DevTools Testing

Open browser console and test the validation function directly:

```javascript
// Paste this in the console after loading the form
import { calculateAgeInMonths, isVaccineAgeAppropriate, getAgeEligibilityMessage } from '@/lib/vaccinationValidation'

// Test with a 2-month-old puppy
const puppyDOB = new Date();
puppyDOB.setDate(puppyDOB.getDate() - 56);
console.log("Age:", calculateAgeInMonths(puppyDOB)); // Should be ~2
console.log("Eligibility for 4-month vaccine:", isVaccineAgeAppropriate(puppyDOB, 4)); // Should be false
console.log("Message:", getAgeEligibilityMessage(puppyDOB, 4, "DHPPiL")); // Should mention weeks until eligible
```

### Performance Considerations

- Age calculation runs on every vaccine selection (negligible impact)
- No API calls needed for age validation (all client-side)
- Message rendering is instant
- No noticeable lag when switching between vaccines/pets

### Screenshots to Capture

- [ ] Green checkmark message (eligible puppy)
- [ ] Amber warning message (too young)
- [ ] Age formatting for newborn, weeks, months, years
- [ ] Message color change when switching pets
- [ ] Multiple pets showing different eligibility
