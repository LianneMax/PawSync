import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Pet from '../models/Pet';
import Appointment from '../models/Appointment';
import MedicalRecord from '../models/MedicalRecord';
import Vaccination from '../models/Vaccination';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';

// Targets every account created by seedUatUsers.ts — identified by the
// @pawsync.dev domain, which is used exclusively for UAT dummy accounts.
const UAT_EMAIL_PATTERN = /@pawsync\.test$/;

async function main() {
  await connectDatabase();

  // Find all UAT users (pet owners + the two seed vets)
  const uatUsers = await User.find({ email: { $regex: UAT_EMAIL_PATTERN } });
  const uatUserIds = uatUsers.map((u) => u._id);

  if (uatUsers.length === 0) {
    console.log('ℹ️  No UAT users found. Nothing to clear.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${uatUsers.length} UAT user(s). Deleting all associated data...\n`);

  // Collect pet IDs so we can delete vaccinations (linked by petId, not ownerId)
  const uatPets = await Pet.find({ ownerId: { $in: uatUserIds } });
  const uatPetIds = uatPets.map((p) => p._id);

  const [vaccinationResult, medRecordResult, appointmentResult, petResult] = await Promise.all([
    Vaccination.deleteMany({ petId: { $in: uatPetIds } }),
    MedicalRecord.deleteMany({ ownerId: { $in: uatUserIds } }),
    Appointment.deleteMany({ ownerId: { $in: uatUserIds } }),
    Pet.deleteMany({ ownerId: { $in: uatUserIds } }),
  ]);

  console.log(`✅ Deleted ${vaccinationResult.deletedCount} vaccination(s)`);
  console.log(`✅ Deleted ${medRecordResult.deletedCount} medical record(s)`);
  console.log(`✅ Deleted ${appointmentResult.deletedCount} appointment(s)`);
  console.log(`✅ Deleted ${petResult.deletedCount} pet(s)`);

  const userResult = await User.deleteMany({ email: { $regex: UAT_EMAIL_PATTERN } });
  console.log(`✅ Deleted ${userResult.deletedCount} user(s)`);

  // Clinics and branches are left intact by default.
  // If the UAT clinics were created fresh by the seed script and you want to
  // remove them too, uncomment the block below.
  //
  // ⚠️  Do NOT uncomment if "BaiVet Animal Clinic" is your real production clinic.
  //
  // const uatClinicNames = ['BaiVet Animal Clinic', 'Metro Vet Clinic'];
  // const uatClinics = await Clinic.find({ name: { $in: uatClinicNames } });
  // const uatClinicIds = uatClinics.map((c) => c._id);
  // await ClinicBranch.deleteMany({ clinicId: { $in: uatClinicIds } });
  // await Clinic.deleteMany({ _id: { $in: uatClinicIds } });
  // console.log(`✅ Deleted ${uatClinics.length} UAT clinic(s) and their branches`);

  console.log('\n✅ UAT data cleared. Database is back to its pre-seed state.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Clear failed:', err);
  process.exit(1);
});


//last test
