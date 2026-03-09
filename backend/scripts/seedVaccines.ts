/**
 * Seed script to populate VaccineType database with recommended vaccine configurations
 * 
 * Usage:
 *   npx ts-node backend/scripts/seedVaccines.ts
 * 
 * This script creates standard vaccination protocols based on:
 * - AAFP (American Association of Feline Practitioners) guidelines
 * - AAHA (American Animal Hospital Association) guidelines
 * - User-provided vaccination schedule requirements
 */

import mongoose from 'mongoose';
import VaccineType from '../src/models/VaccineType';

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync';

// ─────────────────────────────────────────────────────────────────────────────
// Canine (Dog) Vaccines
// ─────────────────────────────────────────────────────────────────────────────

const canineVaccines = [
  // Puppy Series - DHPPiL
  {
    name: 'DHPPiL (1st dose - 6 weeks)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 1.5,
    maxAgeMonths: 6,
    route: 'intramuscular',
    pricePerDose: 45,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'DHPPiL (2nd dose - 8-9 weeks)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 2,
    maxAgeMonths: 8,
    route: 'intramuscular',
    pricePerDose: 45,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'DHPPiL (3rd dose - 12 weeks)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 3,
    maxAgeMonths: 10,
    route: 'intramuscular',
    pricePerDose: 45,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'DHPPiL (Final - 16 weeks)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 1095, // 3 years for adult immunity
    minAgeMonths: 4,
    maxAgeMonths: 12,
    route: 'intramuscular',
    pricePerDose: 50,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Rabies - Initial
  {
    name: 'Rabies (Initial - puppy)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 365,
    minAgeMonths: 4,
    maxAgeMonths: 16,
    route: 'intramuscular',
    pricePerDose: 35,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Adult boosters
  {
    name: 'DHPPiL Booster (Adult)',
    species: ['dog'],
    validityDays: 1095, // 3 years
    requiresBooster: true,
    boosterIntervalDays: 1095,
    minAgeMonths: 12,
    maxAgeMonths: null, // No maximum
    route: 'intramuscular',
    pricePerDose: 50,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'Rabies Booster (Annual)',
    species: ['dog'],
    validityDays: 365, // 1 year
    requiresBooster: true,
    boosterIntervalDays: 365,
    minAgeMonths: 12,
    maxAgeMonths: null,
    route: 'intramuscular',
    pricePerDose: 40,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'Rabies Booster (3-year)',
    species: ['dog'],
    validityDays: 1095, // 3 years
    requiresBooster: true,
    boosterIntervalDays: 1095,
    minAgeMonths: 12,
    maxAgeMonths: null,
    route: 'intramuscular',
    pricePerDose: 40,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Kennel Cough
  {
    name: 'Bordetella (Kennel Cough - 8-9 weeks)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 365,
    minAgeMonths: 2,
    maxAgeMonths: null,
    route: 'oral',
    pricePerDose: 30,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Leptospirosis
  {
    name: 'Leptospirosis (HIGH-RISK - 6-month booster)',
    species: ['dog'],
    validityDays: 180,
    requiresBooster: true,
    boosterIntervalDays: 180,
    minAgeMonths: 3,
    maxAgeMonths: null,
    route: 'intramuscular',
    pricePerDose: 25,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Combination vaccines
  {
    name: '6-in-1 Vaccine (Transition formula)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 1.5,
    maxAgeMonths: 8,
    route: 'intramuscular',
    pricePerDose: 55,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: '8-in-1 Vaccine (High-risk leptospirosis)',
    species: ['dog'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 3,
    maxAgeMonths: 10,
    route: 'intramuscular',
    pricePerDose: 65,
    defaultManufacturer: 'Zoetis',
    defaultBatchNumber: null,
    isActive: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Feline (Cat) Vaccines
// ─────────────────────────────────────────────────────────────────────────────

const felineVaccines = [
  // Kitten Series - FVRCP
  {
    name: 'FVRCP (1st dose - 6-8 weeks)',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 1.5,
    maxAgeMonths: 4,
    route: 'intramuscular',
    pricePerDose: 40,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'FVRCP (2nd dose - 10-12 weeks)',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 21,
    minAgeMonths: 2.5,
    maxAgeMonths: 6,
    route: 'intramuscular',
    pricePerDose: 40,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'FVRCP (Final - 14-16 weeks)',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 1095, // 3 years
    minAgeMonths: 3.5,
    maxAgeMonths: 8,
    route: 'intramuscular',
    pricePerDose: 45,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Rabies - Initial
  {
    name: 'Rabies (Initial - kitten)',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 365,
    minAgeMonths: 4,
    maxAgeMonths: 16,
    route: 'intramuscular',
    pricePerDose: 35,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },

  // Adult Boosters
  {
    name: 'FVRCP Booster (Adult - 3 year)',
    species: ['cat'],
    validityDays: 1095, // 3 years
    requiresBooster: true,
    boosterIntervalDays: 1095,
    minAgeMonths: 12,
    maxAgeMonths: null,
    route: 'intramuscular',
    pricePerDose: 45,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'Rabies Booster (Annual)',
    species: ['cat'],
    validityDays: 365,
    requiresBooster: true,
    boosterIntervalDays: 365,
    minAgeMonths: 12,
    maxAgeMonths: null,
    route: 'intramuscular',
    pricePerDose: 40,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },
  {
    name: 'Rabies Booster (3-year)',
    species: ['cat'],
    validityDays: 1095,
    requiresBooster: true,
    boosterIntervalDays: 1095,
    minAgeMonths: 12,
    maxAgeMonths: null,
    route: 'intramuscular',
    pricePerDose: 40,
    defaultManufacturer: 'Merck',
    defaultBatchNumber: null,
    isActive: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seeding Function
// ─────────────────────────────────────────────────────────────────────────────

async function seedVaccines() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB');

    // Check if vaccines already exist
    const existingCount = await VaccineType.countDocuments();
    if (existingCount > 0) {
      console.log(
        `⚠️  Database already has ${existingCount} vaccine types. Clear them first if you want to reseed.`
      );
      const confirm = process.argv.includes('--force');
      if (!confirm) {
        console.log('Use --force flag to overwrite: npx ts-node backend/scripts/seedVaccines.ts --force');
        await mongoose.disconnect();
        return;
      }
      console.log('🗑️  Clearing existing vaccines...');
      await VaccineType.deleteMany({});
    }

    // Insert canine vaccines
    console.log('📝 Inserting canine vaccines...');
    const insertedCanine = await VaccineType.insertMany(canineVaccines);
    console.log(`✅ Created ${insertedCanine.length} canine vaccine types`);

    // Insert feline vaccines
    console.log('📝 Inserting feline vaccines...');
    const insertedFeline = await VaccineType.insertMany(felineVaccines);
    console.log(`✅ Created ${insertedFeline.length} feline vaccine types`);

    // Print summary
    console.log('\n📊 Seeding Summary:');
    console.log(`   • Canine vaccines: ${insertedCanine.length}`);
    console.log(`   • Feline vaccines: ${insertedFeline.length}`);
    console.log(`   • Total: ${insertedCanine.length + insertedFeline.length}`);

    // Print example vaccines
    console.log('\n📋 Sample Vaccines Created:');
    console.log('   Canine:');
    insertedCanine.slice(0, 3).forEach((v) => {
      console.log(`     • ${v.name} (min: ${v.minAgeMonths}mo, max: ${v.maxAgeMonths || '∅'})`);
    });
    console.log('   Feline:');
    insertedFeline.slice(0, 3).forEach((v) => {
      console.log(`     • ${v.name} (min: ${v.minAgeMonths}mo, max: ${v.maxAgeMonths || '∅'})`);
    });

    console.log('\n✨ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  seedVaccines();
}

export { seedVaccines };
