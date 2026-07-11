import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Pet from '../models/Pet';
import Appointment from '../models/Appointment';

const VET_ID = '69c09c44d69d4570e96c5756';

// UTC midnight so dateOnly() returns today's YYYY-MM-DD in any timezone
const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0);

const PET_IDS = [
  '69c0a860ecffe5509c6d1e31',
  '69c09abbfabdec10364d6fc2',
  '69c09b8cfabdec10364d6ff0',
];

const APPOINTMENTS = [
  {
    petId: '69c0a860ecffe5509c6d1e31',
    isEmergency: true,
    types: ['Emergency'],
    startTime: '08:00',
    endTime: '08:30',
    status: 'confirmed' as const,
  },
  {
    petId: '69c09abbfabdec10364d6fc2', // female
    isEmergency: false,
    types: ['General Check-up'],
    startTime: '14:00',
    endTime: '14:30',
    status: 'confirmed' as const,
  },
  {
    petId: '69c09b8cfabdec10364d6ff0', // male
    isEmergency: false,
    types: ['Vaccination'],
    startTime: '15:00',
    endTime: '15:30',
    status: 'confirmed' as const,
  },
];

async function main() {
  await connectDatabase();

  const vet = await User.findById(VET_ID);
  if (!vet) throw new Error(`Vet not found: ${VET_ID}`);

  console.log(`✅ Vet: ${vet.firstName} ${vet.lastName} (${vet.email})`);

  // Wipe any previously seeded appointments for these pets+vet to avoid duplicates
  const deleted = await Appointment.deleteMany({
    vetId: vet._id,
    petId: { $in: PET_IDS.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  if (deleted.deletedCount > 0) {
    console.log(`🗑️  Removed ${deleted.deletedCount} stale appointment(s)`);
  }

  // Derive clinicId from vet record, or fall back to existing appointments on the target pets
  let clinicId = vet.clinicId as mongoose.Types.ObjectId | null;
  let clinicBranchId = vet.clinicBranchId as mongoose.Types.ObjectId | null;

  if (!clinicId) {
    const refAppt = await Appointment.findOne({ vetId: vet._id, clinicId: { $ne: null } });
    if (refAppt) {
      clinicId = refAppt.clinicId as mongoose.Types.ObjectId;
      clinicBranchId = refAppt.clinicBranchId as mongoose.Types.ObjectId;
      console.log(`ℹ️  Derived clinic from vet's existing appointment: ${clinicId}`);
    } else {
      const petAppt = await Appointment.findOne({
        petId: { $in: PET_IDS.map((id) => new mongoose.Types.ObjectId(id)) },
        clinicId: { $ne: null },
      });
      if (petAppt) {
        clinicId = petAppt.clinicId as mongoose.Types.ObjectId;
        clinicBranchId = petAppt.clinicBranchId as mongoose.Types.ObjectId;
        console.log(`ℹ️  Derived clinic from pet's existing appointment: ${clinicId}`);
      }
    }
  }

  if (!clinicId) throw new Error('Could not resolve clinicId — set clinicId on vet account or ensure pets have prior appointments');

  for (const apptDef of APPOINTMENTS) {
    const pet = await Pet.findById(apptDef.petId);
    if (!pet) {
      console.error(`❌ Pet not found: ${apptDef.petId}`);
      continue;
    }

    const appt = new Appointment({
      petId: pet._id,
      ownerId: pet.ownerId,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      mode: 'face-to-face',
      types: apptDef.types,
      date: TODAY,
      startTime: apptDef.startTime,
      endTime: apptDef.endTime,
      status: apptDef.status,
      isWalkIn: apptDef.isEmergency,
      isEmergency: apptDef.isEmergency,
    });
    await appt.save();

    console.log(`✅ Created: ${apptDef.types[0]} (${apptDef.isEmergency ? 'EMERGENCY' : 'normal'}) — pet ${apptDef.petId} at ${apptDef.startTime} — _id: ${appt._id}`);
  }

  console.log('\n✅ Done. 3 appointments for today.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
