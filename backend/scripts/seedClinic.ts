/**
 * Seed script to create the initial clinic, main branch, and clinic-admin account.
 *
 * Usage:
 *   npx ts-node backend/scripts/seedClinic.ts
 *
 * Use --force to overwrite existing data.
 */

import mongoose from 'mongoose';
import Clinic from '../src/models/Clinic';
import ClinicBranch from '../src/models/ClinicBranch';
import User from '../src/models/User';

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync';

async function seedClinic() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB');

    const force = process.argv.includes('--force');

    const existingClinic = await Clinic.findOne({ name: 'Baivet' });
    if (existingClinic) {
      if (!force) {
        console.log('⚠️  Clinic already exists. Use --force to overwrite.');
        await mongoose.disconnect();
        return;
      }
      console.log('🗑️  Removing existing clinic data...');
      await Clinic.deleteMany({});
      await ClinicBranch.deleteMany({});
      await User.deleteMany({ userType: 'clinic-admin', email: 'baivet@gmail.com' });
    }

    // 1. Create the clinic
    const clinic = await Clinic.create({
      name: 'Baivet',
      mainBranchId: null,
      isActive: true,
    });
    console.log(`✅ Clinic created: ${clinic.name} (${clinic._id})`);

    // 2. Create the main branch
    const branch = await ClinicBranch.create({
      clinicId: clinic._id,
      name: 'Baivet Paranaque',
      address: 'Merville Paranaque Metro Manila',
      isMain: true,
      isActive: true,
    });
    console.log(`✅ Branch created: ${branch.name} (${branch._id})`);

    // 3. Link the main branch back to the clinic
    await Clinic.findByIdAndUpdate(clinic._id, { mainBranchId: branch._id });
    console.log(`✅ Clinic mainBranchId set to branch`);

    // 4. Create the clinic-admin user
    const admin = await User.create({
      email: 'baivet@gmail.com',
      password: 'baivet',
      firstName: 'Baivet',
      lastName: 'Admin',
      userType: 'clinic-admin',
      clinicId: clinic._id,
      clinicBranchId: branch._id,
      isMainBranch: true,
      isVerified: true,
      emailVerified: true,
    });
    console.log(`✅ Admin user created: ${admin.email}`);

    console.log('\n📊 Seed Summary:');
    console.log(`   • Clinic:  ${clinic.name} (${clinic._id})`);
    console.log(`   • Branch:  ${branch.name} (${branch._id})`);
    console.log(`   • Admin:   ${admin.email}`);
    console.log('\n✨ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  seedClinic();
}

export { seedClinic };
