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
    boosterIntervalDays: 21,
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
    if (count > 0) return; // Already seeded

    await VaccineType.insertMany(VACCINE_SEEDS);
    console.log(`✅ Seeded ${VACCINE_SEEDS.length} vaccine types`);
  } catch (error) {
    console.error('❌ Failed to seed vaccine types:', error);
  }
}
