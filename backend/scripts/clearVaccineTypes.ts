/**
 * One-time script to delete all vaccine type documents from the database.
 *
 * Usage:
 *   npx ts-node backend/scripts/clearVaccineTypes.ts
 */

import mongoose from 'mongoose';
import VaccineType from '../src/models/VaccineType';

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync';

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log('Connected to MongoDB');

  const result = await VaccineType.deleteMany({});
  console.log(`Deleted ${result.deletedCount} vaccine type(s).`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
