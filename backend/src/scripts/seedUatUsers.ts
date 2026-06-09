import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Pet from '../models/Pet';
import Appointment from '../models/Appointment';
import Vaccination from '../models/Vaccination';
import MedicalRecord from '../models/MedicalRecord';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';

// ─── Shared UAT credentials ────────────────────────────────────────────────
// All 40 accounts use the same password. Hand out the numbered email + this password.
const UAT_PASSWORD = 'UatTest123!';

// ─── Name pool ─────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Maria', 'Jose', 'Ana', 'Juan', 'Rosa',
  'Carlo', 'Pia', 'Marco', 'Liza', 'Ben',
  'Cleo', 'Dino', 'Eva', 'Felix', 'Gina',
  'Hank', 'Iris', 'Jake', 'Kim', 'Leo',
];
const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia',
  'Mendoza', 'Torres', 'Lim', 'Sy', 'Tan',
  'Flores', 'Gomez', 'Ramos', 'Aquino', 'Castro',
  'Villanueva', 'Dela Cruz', 'Bernardo', 'Ocampo', 'Manalo',
];
const DOG_BREEDS = ['Aspin', 'Shih Tzu', 'Labrador Retriever', 'Golden Retriever', 'Beagle'];
const CAT_BREEDS = ['Puspin', 'Persian', 'Siamese', 'Maine Coon', 'Scottish Fold'];
const DOG_NAMES  = ['Choco', 'Buddy', 'Max', 'Charlie', 'Rocky', 'Mochi', 'Coco', 'Bruno', 'Toby', 'Zeus'];
const CAT_NAMES  = ['Luna', 'Nala', 'Bella', 'Mimi', 'Kitty', 'Cream', 'Shadow', 'Simba', 'Cleo', 'Oreo'];

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getOrCreateClinic(name: string, address: string) {
  let clinic = await Clinic.findOne({ name });
  if (!clinic) {
    clinic = await Clinic.create({ name, address, isActive: true });
    console.log(`✅ Created clinic: ${name}`);
  } else {
    console.log(`⏭️  Using existing clinic: ${name}`);
  }

  let branch = await ClinicBranch.findOne({ clinicId: clinic._id, isMain: true });
  if (!branch) {
    branch = await ClinicBranch.create({
      clinicId: clinic._id,
      name: `${name} - Main`,
      address,
      isMain: true,
      isActive: true,
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });
    await Clinic.findByIdAndUpdate(clinic._id, { mainBranchId: branch._id });
  }

  return { clinic, branch };
}

async function getOrCreateVet(
  email: string,
  firstName: string,
  lastName: string,
  clinicId: mongoose.Types.ObjectId,
  clinicBranchId: mongoose.Types.ObjectId,
) {
  let vet = await User.findOne({ email });
  if (!vet) {
    vet = new User({
      email,
      password: UAT_PASSWORD,
      firstName,
      lastName,
      userType: 'veterinarian',
      clinicId,
      clinicBranchId,
      isMainBranch: true,
      isVerified: true,
      emailVerified: true,
    });
    await vet.save();
    console.log(`✅ Created vet: ${email}`);
  }
  return vet;
}

// Builds seed data for one pet owner. Skips silently if the owner already has pets.
async function seedOwnerData(
  owner: InstanceType<typeof User>,
  vet: InstanceType<typeof User>,
  clinicId: mongoose.Types.ObjectId,
  clinicBranchId: mongoose.Types.ObjectId,
  globalIdx: number, // 0-based index across all 40 owners, used to spread dates/times
) {
  const existingPet = await Pet.findOne({ ownerId: owner._id });
  if (existingPet) return; // already fully seeded

  const ownerName = `${owner.firstName} ${owner.lastName}`;
  const vetName   = `${vet.firstName} ${vet.lastName}`;

  const dog = await Pet.create({
    ownerId: owner._id,
    name: DOG_NAMES[globalIdx % DOG_NAMES.length],
    species: 'canine',
    breed: DOG_BREEDS[globalIdx % DOG_BREEDS.length],
    sex: 'male',
    dateOfBirth: new Date(2020 + (globalIdx % 4), globalIdx % 12, (globalIdx % 28) + 1),
    weight: 5 + (globalIdx % 20),
    sterilization: globalIdx % 2 === 0 ? 'neutered' : 'unneutered',
    status: 'alive',
    isAlive: true,
    allergies: [],
  });

  const cat = await Pet.create({
    ownerId: owner._id,
    name: CAT_NAMES[globalIdx % CAT_NAMES.length],
    species: 'feline',
    breed: CAT_BREEDS[globalIdx % CAT_BREEDS.length],
    sex: 'female',
    dateOfBirth: new Date(2021 + (globalIdx % 3), globalIdx % 12, (globalIdx % 28) + 1),
    weight: 3 + (globalIdx % 5),
    sterilization: 'spayed',
    pregnancyStatus: 'not_pregnant',
    status: 'alive',
    isAlive: true,
    allergies: [],
  });

  // petSlot 0 = dog, 1 = cat — used to stagger appointment times so the vet
  // isn't double-booked (unique index: vetId + date + startTime for active statuses)
  const pets: [number, typeof dog][] = [[0, dog], [1, cat]];

  for (const [petSlot, pet] of pets) {
    // Past completed appointment — unique index doesn't apply to 'completed' status
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 3 - petSlot);
    pastDate.setDate((globalIdx % 28) + 1);
    const pastHour = (8 + (globalIdx % 8)).toString().padStart(2, '0');

    const pastAppt = await Appointment.create({
      petId: pet._id,
      ownerId: owner._id,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      mode: 'face-to-face',
      types: ['General Check-up'],
      date: pastDate,
      startTime: `${pastHour}:00`,
      endTime: `${pastHour}:30`,
      status: 'completed',
      isWalkIn: false,
      isEmergency: false,
    });

    // Medical record linked to the past appointment
    const medRecord = await MedicalRecord.create({
      petId: pet._id,
      ownerId: owner._id,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      appointmentId: pastAppt._id,
      petIsAlive: true,
      ownerAtTime: { name: ownerName, id: owner._id },
      vetAtTime:   { name: vetName,   id: vet._id },
      stage: 'completed',
      chiefComplaint: 'Routine wellness check-up.',
      vitals: {
        weight:             { value: pet.weight, notes: '' },
        temperature:        { value: 38.5, notes: '' },
        pulseRate:          { value: 88,   notes: '' },
        spo2:               { value: 98,   notes: '' },
        bodyConditionScore: { value: 3,    notes: '' },
        dentalScore:        { value: 2,    notes: '' },
        crt:                { value: '',   notes: '' },
        pregnancy:          { value: '',   notes: '' },
        xray:               { value: '',   notes: '' },
        vaccinated:         { value: 'Yes', notes: '' },
      },
      visitSummary: 'Pet is in good health. No abnormalities found.',
      subjective:   'Owner reports pet is eating well and active.',
      assessment:   'Healthy pet. No signs of illness.',
      plan:         'Continue current diet. Schedule follow-up in 12 months.',
      sharedWithOwner: true,
      isCurrent: false,
      medications:    [],
      diagnosticTests: [],
      preventiveCare:  [],
    });

    await Appointment.findByIdAndUpdate(pastAppt._id, { medicalRecordId: medRecord._id });

    // Upcoming pending appointment — each owner gets a unique date (globalIdx offset),
    // dog at 09:00 and cat at 09:30, so the same vet is never double-booked.
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 14 + globalIdx);
    const upcomingStart = petSlot === 0 ? '09:00' : '09:30';
    const upcomingEnd   = petSlot === 0 ? '09:30' : '10:00';

    await Appointment.create({
      petId: pet._id,
      ownerId: owner._id,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      mode: 'face-to-face',
      types: ['Vaccination'],
      date: upcomingDate,
      startTime: upcomingStart,
      endTime:   upcomingEnd,
      status: 'pending',
      isWalkIn: false,
      isEmergency: false,
    });

    // Active vaccination (3 months ago, due next year)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await Vaccination.create({
      petId: pet._id,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      appointmentId:  pastAppt._id,
      medicalRecordId: medRecord._id,
      vaccineName:  pet.species === 'canine' ? 'Rabies Vaccine' : 'FVRCP Vaccine',
      manufacturer: 'Merial',
      batchNumber:  `UAT-${globalIdx.toString().padStart(2, '0')}-${petSlot}A`,
      route: 'subcutaneous',
      administeredDoseMl: 1.0,
      dateAdministered: threeMonthsAgo,
      nextDueDate: nextYear,
      doseNumber: 1,
      boosterNumber: 0,
      notes: 'Administered during routine wellness visit.',
    });

    // Overdue vaccination (given 1 year ago, due yesterday)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await Vaccination.create({
      petId: pet._id,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      vaccineName:  pet.species === 'canine' ? 'DHPPiL Vaccine' : 'Rabies Vaccine',
      manufacturer: 'Boehringer Ingelheim',
      batchNumber:  `UAT-${globalIdx.toString().padStart(2, '0')}-${petSlot}B`,
      route: 'intramuscular',
      administeredDoseMl: 1.0,
      dateAdministered: oneYearAgo,
      nextDueDate: yesterday,
      doseNumber: 1,
      boosterNumber: 0,
      notes: 'Previous annual vaccination — now overdue for renewal.',
    });
  }

  console.log(`  ↳ Pets, appointments, and vaccinations seeded`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  await connectDatabase();

  // NOTE: If BaiVet already exists in the DB under a different name, update
  // the name string below to match so the script reuses the existing clinic.
  const { clinic: baivetClinic, branch: baivetBranch } = await getOrCreateClinic(
    'BaiVet Animal Clinic',
    '123 Veterinary St., Makati City',
  );
  const baivetVet = await getOrCreateVet(
    'uat-baivet-vet@pawsync.dev',
    'BaiVet', 'UAT Vet',
    baivetClinic._id as mongoose.Types.ObjectId,
    baivetBranch._id as mongoose.Types.ObjectId,
  );

  const { clinic: externalClinic, branch: externalBranch } = await getOrCreateClinic(
    'Metro Vet Clinic',
    '456 Animal Blvd., Quezon City',
  );
  const externalVet = await getOrCreateVet(
    'uat-external-vet@pawsync.dev',
    'Metro', 'UAT Vet',
    externalClinic._id as mongoose.Types.ObjectId,
    externalBranch._id as mongoose.Types.ObjectId,
  );

  const groups = [
    { label: 'baivet',   count: 20, clinic: baivetClinic,   branch: baivetBranch,   vet: baivetVet },
    { label: 'external', count: 20, clinic: externalClinic, branch: externalBranch, vet: externalVet },
  ];

  let globalIdx = 0;

  for (const group of groups) {
    console.log(`\n── ${group.label.toUpperCase()} GROUP (${group.count} users) ──`);

    for (let i = 1; i <= group.count; i++) {
      const n         = i.toString().padStart(2, '0');
      const email     = `uat-${group.label}-${n}@pawsync.dev`;
      const firstName = FIRST_NAMES[globalIdx % FIRST_NAMES.length];
      const lastName  = LAST_NAMES[globalIdx % LAST_NAMES.length];
      // Sequential PH-format numbers to satisfy the unique contactNumberNormalized index
      const contactNumber = `091${(globalIdx + 1).toString().padStart(8, '0')}`;

      let owner = await User.findOne({ email });
      if (!owner) {
        owner = new User({
          email,
          password: UAT_PASSWORD,
          firstName,
          lastName,
          contactNumber,
          userType: 'pet-owner',
          inviteStatus: 'activated',
          emailVerified: true,
          isVerified: false,
          clinicId: null,
          clinicBranchId: null,
          isMainBranch: false,
        });
        await owner.save();
        console.log(`✅ Created: ${email}`);
      } else {
        console.log(`⏭️  Exists:  ${email}`);
      }

      await seedOwnerData(
        owner,
        group.vet,
        group.clinic._id as mongoose.Types.ObjectId,
        group.branch._id as mongoose.Types.ObjectId,
        globalIdx,
      );

      globalIdx++;
    }
  }

  console.log('\n✅ UAT seed complete. 40 accounts ready.');
  console.log('   Password for all accounts: UatTest123!');
  console.log('   Baivet   emails: uat-baivet-01@pawsync.dev … uat-baivet-20@pawsync.dev');
  console.log('   External emails: uat-external-01@pawsync.dev … uat-external-20@pawsync.dev');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
