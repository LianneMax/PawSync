# Vaccine Setup Guide - Minimum & Maximum Ages

This guide provides the recommended minimum and maximum ages (in months) for each vaccine type when setting up vaccine records in PawSync.

## Important Concept: Age Ranges for Vaccines

- **Minimum Age**: The earliest age at which a pet should receive the vaccine (e.g., puppy series)
- **Maximum Age**: The latest age at which a vaccine is recommended for that specific formulation (e.g., DHPPiL puppy series shouldn't be given to adult dogs who should receive adult booster)
- **Leave Maximum Empty**: For vaccines with no upper age limit (e.g., annual rabies boosters for adults)

## Vaccine Type Setup

When creating a vaccine type in the clinic admin panel, use these age values:

### Canine (Dog) Vaccines

| Vaccine Name | Min Age (months) | Max Age (months) | Species | Validity | Requires Booster | Booster Interval | Route | Notes |
|---|---|---|---|---|---|---|---|---|
| DHPPiL (1st dose) | 1.5 | 6 | dog | 365 | Yes | 21 | IM/SC | First core vaccination at 6 weeks; shouldn't be used on dogs >6mo |
| DHPPiL (2nd dose) | 2 | 8 | dog | 365 | Yes | 21 | IM/SC | Second dose at 8-9 weeks; puppy series only |
| DHPPiL (3rd dose) | 3 | 10 | dog | 365 | Yes | 21 | IM/SC | Third dose at 12 weeks; for puppies |
| DHPPiL (Final/4th) | 4 | 12 | dog | 365 | Yes | 1095 | IM/SC | Final puppy dose at 16+ weeks; ≥16 weeks for immunity |
| DHPPiL Booster (Adult) | 12 | ∅ | dog | 1095 | Yes | 1095 | IM/SC | Annual/triennial booster for adult dogs |
| Rabies (Puppy) | 4 | 16 | dog | 365 | Yes | 365 | IM/SC | Initial vaccination at 16+ weeks |
| Rabies Booster | 12 | ∅ | dog | 365 | Yes | 365 | IM/SC | Annual booster after initial series |
| Kennel Cough (Oral) | 2 | ∅ | dog | 365 | Yes | 365 | Oral | 8-9 weeks; booster annually; for high-risk dogs |
| Leptospirosis | 3 | ∅ | dog | 365 | Yes | 180 | IM/SC | High-risk areas: booster every 6 months |
| 6-in-1 Vaccine | 1.5 | 8 | dog | 365 | Yes | 21 | IM/SC | For transitions between vaccination programs |
| 8-in-1 Vaccine | 3 | 10 | dog | 365 | Yes | 21 | IM/SC | Broad leptospiral coverage; for high-risk areas |

### Feline (Cat) Vaccines

| Vaccine Name | Min Age (months) | Max Age (months) | Species | Validity | Requires Booster | Booster Interval | Route | Notes |
|---|---|---|---|---|---|---|---|---|
| FVRCP (1st dose) | 1.5 | 4 | cat | 365 | Yes | 21 | IM/SC | First core vaccination at 6-8 weeks; kitten only |
| FVRCP (2nd dose) | 2.5 | 6 | cat | 365 | Yes | 21 | IM/SC | Second dose at 10-12 weeks; kitten only |
| FVRCP (Final/3rd) | 3.5 | 8 | cat | 365 | Yes | 1095 | IM/SC | Final dose at 14-16 weeks; kitten series |
| FVRCP Booster (Adult) | 12 | ∅ | cat | 1095 | Yes | 1095 | IM/SC | Booster every 3 years after initial series |
| Rabies (Kitten) | 4 | 16 | cat | 365 | Yes | 365 | IM/SC | Initial vaccination at 16+ weeks |
| Rabies Booster | 12 | ∅ | cat | 365 | Yes | 365 | IM/SC | Annual booster after initial |

## Key Principles

### ∅ (No Maximum) vs. Specific Maximum
- **∅ (empty/null)**: Vaccine is appropriate for any age above the minimum (e.g., adult rabies boosters)
- **Specific number**: Vaccine is only for that age range (e.g., DHPPiL puppy doses only for puppies under 12 months)

### Validation Behavior

When staff selects a vaccine:

| Scenario | Min Age | Max Age | Result |
|---|---|---|---|
| Pet too young | 4mo | ∅ | ⚠️ "Pet is 2 months old... requires 4 months... in 8 weeks" |
| Pet in range | 4mo | ∅ | ✅ "Pet is 6 months old - eligible" |
| Pet too old | 4mo | 12mo | ⚠️ "Pet is 2 years old. Too old for DHPPiL (recommended age: 4-12 months)" |
| Adult vaccine | 12mo | ∅ | ✅ "Pet is 3 years old - eligible" |

## Best Practices

### 1. **Separate Puppy and Adult Formulations**
Create distinct vaccine types:
- "DHPPiL (Puppy Series)" - min: 1.5, max: 12
- "DHPPiL (Adult Booster)" - min: 12, max: ∅

This prevents accidental use of puppy formulations on adult dogs.

### 2. **Follow Standard Protocols**
- Use established veterinary guidelines (AAFP, AAHA)
- Keep dog and cat vaccines separate
- Specify correct route (IM = Intramuscular, SC = Subcutaneous)

### 3. **Realistic Age Ranges**
- **Puppy series**: Typically conclude by 16 weeks (4 months)
- **Juvenile/Adolescent**: 4-12 months for first booster after puppy series
- **Adult**: 12+ months for ongoing boosters

### 4. **Validity Periods**
- Puppy series doses: Usually 365 days validity
- Final dose + rabies: Usually 365 or 1095 days (1 or 3 years)
- FVRCP in cats: 1095 days (3 years after initial series)

### 5. **Booster Settings**
- Puppy series: 21-28 days between doses
- Adult annual: 365 days
- Adult triennial: 1095 days
- Special cases: Leptospirosis 180 days in high-risk areas

## Safety Guidelines

Per the vaccination safety protocol:

- Always perform full physical exam before vaccination
- Postpone if patient has fever, active infection, severe illness, or stress
- Consider antibody titer testing for individualized plans
- **Age validation is a safety check**, not a replacement for veterinary judgment

## Common Setup Examples

### Example 1: Standard Canine Puppy Series
```
1. DHPPiL (1st, 6 weeks)
   Min: 1.5, Max: 6, Route: IM, Booster: Yes (21 days)

2. DHPPiL (2nd, 8-9 weeks)
   Min: 2, Max: 8, Route: IM, Booster: Yes (21 days)

3. DHPPiL (3rd, 12 weeks)
   Min: 3, Max: 10, Route: IM, Booster: Yes (21 days)

4. DHPPiL (Final, 16 weeks) + Rabies
   Min: 4, Max: 12, Route: IM, Booster: Yes (1095 days)

5. DHPPiL (Adult Booster)
   Min: 12, Max: ∅, Route: IM, Booster: Yes (1095 days)
```

### Example 2: Kitty Series
```
1. FVRCP (1st, 6-8 weeks)
   Min: 1.5, Max: 4, Route: IM, Booster: Yes (21 days)

2. FVRCP (2nd, 10-12 weeks)
   Min: 2.5, Max: 6, Route: IM, Booster: Yes (21 days)

3. FVRCP (Final, 14-16 weeks) + Rabies
   Min: 3.5, Max: 8, Route: IM, Booster: Yes (1095 days)

4. FVRCP (Adult Booster)
   Min: 12, Max: ∅, Route: IM, Booster: Yes (1095 days)
```

## Troubleshooting

**Q: Why assign a max age?**
A: Prevents accidentally giving puppy vaccines to older animals who need adult formulations.

**Q: What if I don't know the max age?**
A: Leave it empty - the system will only check minimum age.

**Q: Can staff override age warnings?**
A: Yes. Warnings are precautionary; vets have final authority.

**Q: Does max age appear on public vaccine cards?**
A: No - only in the admin interface for guidance.

## References

- AAFP (American Association of Feline Practitioners) Vaccination Guidelines
- AAHA (American Animal Hospital Association) Canine Life Stage Guidelines
- Local veterinary regulations and best practices
- Vaccine manufacturer recommendations

