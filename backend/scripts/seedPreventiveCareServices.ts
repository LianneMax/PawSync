/**
 * Seed script to populate ProductService database with preventive care services
 * and their default next-due-date intervals
 * 
 * Usage:
 *   npx ts-node backend/scripts/seedPreventiveCareServices.ts
 * 
 * This script creates standard preventive care services with default intervals:
 * - Deworming: 90 days
 * - Flea and Tick Prevention: 365 days
 * 
 * Note: Rabies Vaccine is handled as a VaccineType, not preventive care
 */

import mongoose from 'mongoose';
import ProductService from '../src/models/ProductService';

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync';

const preventiveCareServices = [
  {
    name: 'Deworming',
    type: 'Service',
    category: 'Preventive Care',
    price: 250,
    description: 'Deworming treatment for internal parasites',
    isActive: true,
    intervalDays: 90,
  },
  {
    name: 'Flea and Tick Prevention',
    type: 'Service',
    category: 'Preventive Care',
    price: 350,
    description: 'Monthly flea and tick prevention treatment',
    isActive: true,
    intervalDays: 30,
  },
];

async function seedPreventiveCareServices() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('✓ Connected to MongoDB');

    for (const service of preventiveCareServices) {
      // Check if service already exists
      const existing = await ProductService.findOne({ name: service.name });
      
      if (existing) {
        // Update existing service with interval if not set
        if (!existing.intervalDays) {
          existing.intervalDays = service.intervalDays;
          await existing.save();
          console.log(`✓ Updated "${service.name}" with intervalDays: ${service.intervalDays} days`);
        } else {
          console.log(`✓ "${service.name}" already exists with intervalDays: ${existing.intervalDays} days`);
        }
      } else {
        // Create new service
        await ProductService.create(service);
        console.log(`✓ Created "${service.name}" with intervalDays: ${service.intervalDays} days`);
      }
    }

    console.log('\n✓ Preventive care services seeded successfully!');
    console.log('  - Deworming: 90-day interval');
    console.log('  - Flea and Tick Prevention: 365-day interval');
    console.log('  - Note: Rabies Vaccine is handled via the vaccine form (VaccineType)');
  } catch (error) {
    console.error('✗ Error seeding preventive care services:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

seedPreventiveCareServices();
