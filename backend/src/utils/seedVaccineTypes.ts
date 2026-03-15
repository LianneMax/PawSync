import VaccineType from '../models/VaccineType';

const VACCINE_SEEDS = [
  {
    name: 'Rabies',
    species: ['dog', 'cat'],
    validityDays: 365,
    requiresBooster: false,
    boosterIntervalDays: null,
    minAgeMonths: 3,
    route: 'subcutaneous',
  },
  {
    name: 'DHPPiL',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    numberOfBoosters: 2,
    boosterIntervalDays: 21,
    // dose 1→2: 21 days (puppy series), dose 2→3: 365 days (annual booster)
    boosterIntervalDaysList: [21, 365],
    minAgeMonths: 1,
    route: 'subcutaneous',
  },
  {
    name: 'DHPPiL Booster',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: false,
    boosterIntervalDays: null,
    minAgeMonths: 0,
    route: 'subcutaneous',
  },
  {
    name: 'Bordetella',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: false,
    boosterIntervalDays: null,
    minAgeMonths: 0,
    route: 'intranasal',
  },
  {
    name: 'Leptospirosis',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: false,
    boosterIntervalDays: null,
    minAgeMonths: 0,
    route: 'subcutaneous',
  },
  {
    name: 'FeLV',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: false,
    boosterIntervalDays: null,
    minAgeMonths: 2,
    route: 'subcutaneous',
  },
  {
    name: 'FVRCP',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: false,
    boosterIntervalDays: null,
    minAgeMonths: 1,
    route: 'subcutaneous',
  },
];

export async function seedVaccineTypes(): Promise<void> {
  try {
    const count = await VaccineType.countDocuments();
    if (count === 0) {
      await VaccineType.insertMany(VACCINE_SEEDS);
      console.log(`✅ Seeded ${VACCINE_SEEDS.length} vaccine types`);
    } else {
      // Backfill numberOfBoosters for existing records that have requiresBooster but no numberOfBoosters set
      await VaccineType.updateMany(
        { requiresBooster: true, $or: [{ numberOfBoosters: { $exists: false } }, { numberOfBoosters: 0 }] },
        { $set: { numberOfBoosters: 1 } }
      );
      // Update specific seeds with known numberOfBoosters values and per-dose intervals
      for (const seed of VACCINE_SEEDS) {
        const updates: Record<string, unknown> = {};
        if ('numberOfBoosters' in seed) updates.numberOfBoosters = seed.numberOfBoosters;
        if ('boosterIntervalDaysList' in seed) updates.boosterIntervalDaysList = seed.boosterIntervalDaysList;
        if (Object.keys(updates).length > 0) {
          await VaccineType.updateOne({ name: seed.name }, { $set: updates });
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to seed vaccine types:', error);
  }
}
