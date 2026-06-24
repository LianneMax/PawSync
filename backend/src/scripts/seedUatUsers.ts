import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Pet from '../models/Pet';
import Appointment from '../models/Appointment';
import Vaccination from '../models/Vaccination';
import MedicalRecord from '../models/MedicalRecord';
import VetReport from '../models/VetReport';
import Billing, { IBillingItem } from '../models/Billing';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import { generateNextInvoiceNumber } from '../services/invoiceNumberService';

// ─── Shared UAT credentials ────────────────────────────────────────────────
// All 70 accounts use the same password. Hand out the numbered email + this password.
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

// ─── Visit history template ───────────────────────────────────────────────
// Each pet gets one completed appointment + medical record per entry below,
// oldest first. The last entry is the "current" record (isCurrent: true) and
// is the one the active vaccination / billing demo gets linked to.
const VISIT_HISTORY = [
  {
    monthsAgo: 9,
    apptType: 'General Check-up',
    chiefComplaint: 'Annual wellness examination.',
    subjective: 'Owner reports pet is active, eating well, and shows no signs of illness.',
    assessment: 'Healthy. No abnormalities detected on physical exam.',
    plan: 'Continue current diet and exercise routine. Recommend annual blood work next visit.',
    vetNotes: 'Coat and skin in good condition. Heart and lungs clear on auscultation.',
    overallObservation: 'Alert, responsive, and in good body condition.',
    prognosis: 'Excellent. No follow-up needed beyond routine annual care.',
    medications: [] as any[],
    diagnosticTests: [
      { testType: 'blood_work', name: 'Complete Blood Count (CBC)', result: 'Within normal limits', normalRange: 'WBC 6-17 x10^9/L', notes: 'No abnormalities noted.' },
    ],
    preventiveCare: [
      { careType: 'deworming', product: 'Drontal Plus', notes: 'Administered per body weight.' },
    ],
  },
  {
    monthsAgo: 6,
    apptType: 'Dermatology Consultation',
    chiefComplaint: 'Owner noticed mild itching and scratching for the past week.',
    subjective: 'Owner reports increased scratching, mostly around the ears and belly. No change in appetite.',
    assessment: 'Mild dermatitis, likely flea allergy dermatitis.',
    plan: 'Prescribed antihistamine and topical flea treatment. Recheck in 2 weeks if symptoms persist.',
    vetNotes: 'Mild erythema noted on ventral abdomen. No fleas visible at time of exam.',
    overallObservation: 'Comfortable but intermittently scratching during exam.',
    prognosis: 'Good. Symptoms expected to resolve fully with treatment within 2 weeks.',
    medications: [
      { name: 'Diphenhydramine', dosage: '25mg', route: 'oral', frequency: 'Twice daily', duration: '7 days', status: 'completed' },
    ],
    diagnosticTests: [
      { testType: 'other', name: 'Skin Scrape', result: 'No mites or parasites detected', notes: 'Negative for sarcoptic mange.' },
    ],
    preventiveCare: [
      { careType: 'flea', product: 'Frontline Plus', notes: 'Applied topically.' },
    ],
  },
  {
    monthsAgo: 3,
    apptType: 'General Check-up',
    chiefComplaint: 'Routine wellness check-up.',
    subjective: 'Owner reports pet is eating well and active.',
    assessment: 'Healthy pet. No signs of illness.',
    plan: 'Continue current diet. Schedule follow-up in 12 months.',
    vetNotes: 'No concerns noted during physical exam.',
    overallObservation: 'Pet is in good health. No abnormalities found.',
    prognosis: 'Excellent. Pet is expected to remain healthy with continued preventive care.',
    medications: [
      { name: 'Multivitamin Supplement', dosage: '1 tablet', route: 'oral', frequency: 'Once daily', duration: '30 days', status: 'active' },
    ],
    diagnosticTests: [
      { testType: 'other', name: 'Fecal Exam', result: 'Negative for parasites' },
    ],
    preventiveCare: [
      { careType: 'heartworm', product: 'Heartgard Plus', notes: 'Monthly preventive given.' },
    ],
  },
];

// ─── Billing demo scenarios ────────────────────────────────────────────────
// Exactly 5 billing records are seeded across the whole run (see BILLING_PLAN
// below), so UAT testers have a small, varied set of invoices to look at.
const BILLING_SCENARIOS: {
  items: Omit<IBillingItem, 'productServiceId' | 'vaccineTypeId'>[];
  discount: number;
  status: 'paid' | 'pending_payment';
  paymentMethod: 'cash' | 'card' | 'qr' | null;
}[] = [
  {
    items: [
      { name: 'General Check-up', type: 'Service', unitPrice: 500, quantity: 1 },
      { name: 'Deworming Tablet', type: 'Product', unitPrice: 150, quantity: 1 },
    ],
    discount: 0,
    status: 'paid',
    paymentMethod: 'cash',
  },
  {
    items: [
      { name: 'Vaccination Service', type: 'Service', unitPrice: 350, quantity: 1 },
      { name: 'Rabies Vaccine', type: 'Product', unitPrice: 450, quantity: 1 },
    ],
    discount: 50,
    status: 'paid',
    paymentMethod: 'card',
  },
  {
    items: [
      { name: 'Dental Cleaning', type: 'Service', unitPrice: 1200, quantity: 1 },
    ],
    discount: 0,
    status: 'pending_payment',
    paymentMethod: null,
  },
  {
    items: [
      { name: 'Dermatology Consultation', type: 'Service', unitPrice: 400, quantity: 1 },
      { name: 'Antihistamine Medication', type: 'Product', unitPrice: 180, quantity: 1 },
    ],
    discount: 0,
    status: 'paid',
    paymentMethod: 'qr',
  },
  {
    items: [
      { name: 'Annual Wellness Package', type: 'Service', unitPrice: 800, quantity: 1 },
      { name: 'Complete Blood Count', type: 'Service', unitPrice: 650, quantity: 1 },
    ],
    discount: 100,
    status: 'pending_payment',
    paymentMethod: null,
  },
];

// Exactly which owners get the demo billing above, keyed by `${groupLabel}-${n}`.
const BILLING_PLAN: Record<string, number> = {
  'baivet-01': 0,
  'baivet-02': 1,
  'baivet-03': 2,
  'external-01': 3,
  'external-02': 4,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

// Approximate clinic neighborhoods, used as the center point for scan-location jitter.
const CLINIC_COORDS = {
  baivet:   { lat: 14.5547, lng: 121.0244 }, // Makati City
  external: { lat: 14.6760, lng: 121.0437 }, // Quezon City
};

// Deterministic small offset (~0-1.5km) so each pet's sightings cluster near
// its clinic but don't all land on the exact same point.
function jitterCoord(base: { lat: number; lng: number }, seed: number) {
  const dLat = ((seed % 7) - 3) * 0.004;
  const dLng = ((seed % 5) - 2) * 0.004;
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

// Builds 3 chronological scan/sighting points (oldest → newest) for one pet.
function buildScanLocations(base: { lat: number; lng: number }, seed: number) {
  const daysAgo = [30, 10, 1];
  return daysAgo.map((d, i) => {
    const { lat, lng } = jitterCoord(base, seed + i);
    const scannedAt = new Date();
    scannedAt.setDate(scannedAt.getDate() - d);
    return { lat, lng, scannedAt };
  });
}

function computeBillingItemTotal(item: Pick<IBillingItem, 'unitPrice' | 'quantity' | 'dispenseFee' | 'injectionFee'>) {
  return item.unitPrice * (item.quantity || 1) + (item.dispenseFee || 0) + (item.injectionFee || 0);
}

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
  clinicCoord: { lat: number; lng: number },
) {
  const existingPet = await Pet.findOne({ ownerId: owner._id });
  if (existingPet) return; // already fully seeded

  const ownerName = `${owner.firstName} ${owner.lastName}`;
  const vetName   = `${vet.firstName} ${vet.lastName}`;

  const dogScanLocations = buildScanLocations(clinicCoord, globalIdx * 10);
  const dogLatestScan = dogScanLocations[dogScanLocations.length - 1];

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
    scanLocations: dogScanLocations,
    lastScannedLat: dogLatestScan.lat,
    lastScannedLng: dogLatestScan.lng,
    lastScannedAt: dogLatestScan.scannedAt,
  });

  const catScanLocations = buildScanLocations(clinicCoord, globalIdx * 10 + 5);
  const catLatestScan = catScanLocations[catScanLocations.length - 1];

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
    scanLocations: catScanLocations,
    lastScannedLat: catLatestScan.lat,
    lastScannedLng: catLatestScan.lng,
    lastScannedAt: catLatestScan.scannedAt,
  });

  // petSlot 0 = dog, 1 = cat — used to stagger appointment times so the vet
  // isn't double-booked (unique index: vetId + date + startTime for active statuses)
  const pets: [number, typeof dog][] = [[0, dog], [1, cat]];

  for (const [petSlot, pet] of pets) {
    // One completed appointment + medical record per VISIT_HISTORY entry (oldest → newest),
    // so every pet ends up with 3 medical reports to look at.
    let lastApptId: mongoose.Types.ObjectId | null = null;
    let lastMedRecordId: mongoose.Types.ObjectId | null = null;

    for (let visitIdx = 0; visitIdx < VISIT_HISTORY.length; visitIdx++) {
      const visit = VISIT_HISTORY[visitIdx];
      const isLatestVisit = visitIdx === VISIT_HISTORY.length - 1;

      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - visit.monthsAgo - petSlot);
      pastDate.setDate((globalIdx % 28) + 1);
      const pastHour = (8 + (globalIdx % 8)).toString().padStart(2, '0');

      const pastAppt = await Appointment.create({
        petId: pet._id,
        ownerId: owner._id,
        vetId: vet._id,
        clinicId,
        clinicBranchId,
        mode: 'face-to-face',
        types: [visit.apptType],
        date: pastDate,
        startTime: `${pastHour}:00`,
        endTime: `${pastHour}:30`,
        status: 'completed',
        isWalkIn: false,
        isEmergency: false,
      });

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
        chiefComplaint: visit.chiefComplaint,
        vitals: {
          weight:             { value: pet.weight, notes: '' },
          temperature:        { value: Number((38.2 + visitIdx * 0.1).toFixed(1)), notes: '' },
          pulseRate:          { value: 80 + visitIdx * 4, notes: '' },
          spo2:               { value: 97 + (visitIdx % 3), notes: '' },
          bodyConditionScore: { value: visitIdx % 2 === 0 ? 3 : 4, notes: '' },
          dentalScore:        { value: visitIdx % 2 === 0 ? 1 : 2, notes: '' },
          crt:                { value: '',   notes: '' },
          pregnancy:          { value: '',   notes: '' },
          xray:               { value: '',   notes: '' },
          vaccinated:         { value: 'Yes', notes: '' },
        },
        visitSummary: visit.overallObservation,
        vetNotes: visit.vetNotes,
        overallObservation: visit.overallObservation,
        subjective:   visit.subjective,
        assessment:   visit.assessment,
        plan:         visit.plan,
        sharedWithOwner: true,
        isCurrent: isLatestVisit,
        medications:     visit.medications as any,
        diagnosticTests: visit.diagnosticTests as any,
        preventiveCare:  visit.preventiveCare as any,
      });

      await Appointment.findByIdAndUpdate(pastAppt._id, { medicalRecordId: medRecord._id });

      // Diagnostic report — this is what powers the owner-facing "Reports" tab
      // on /my-pets, which reads from VetReport, not MedicalRecord.
      const primaryTest = visit.diagnosticTests[0];
      await VetReport.create({
        petId: pet._id,
        medicalRecordId: medRecord._id,
        vetId: vet._id,
        clinicId,
        clinicBranchId,
        title: `${visit.apptType} Report`,
        reportDate: pastDate,
        vetContextNotes: visit.chiefComplaint,
        sections: {
          clinicalSummary: visit.overallObservation,
          laboratoryInterpretation: primaryTest
            ? `${primaryTest.name}: ${primaryTest.result}`
            : 'No laboratory testing performed at this visit.',
          diagnosticIntegration: visit.assessment,
          assessment: visit.assessment,
          managementPlan: visit.plan,
          prognosis: visit.prognosis,
        },
        ownerSummary: {
          whatWeFound: visit.chiefComplaint,
          testResultsExplained: primaryTest
            ? `We ran a ${primaryTest.name.toLowerCase()} and the result was: ${primaryTest.result.toLowerCase()}.`
            : 'No lab tests were needed for this visit.',
          whatsHappeningInTheirBody: visit.assessment,
          theDiagnosis: visit.assessment,
          theTreatmentPlan: visit.plan,
          whatToExpect: visit.prognosis,
        },
        isAIGenerated: false,
        status: 'finalized',
        sharedWithOwner: true,
        sharedAt: pastDate,
      });

      lastApptId = pastAppt._id as mongoose.Types.ObjectId;
      lastMedRecordId = medRecord._id as mongoose.Types.ObjectId;
    }

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

    // Active vaccination (3 months ago, due next year) — linked to the most recent visit
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await Vaccination.create({
      petId: pet._id,
      vetId: vet._id,
      clinicId,
      clinicBranchId,
      appointmentId:  lastApptId,
      medicalRecordId: lastMedRecordId,
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

  console.log(`  ↳ Pets, appointments, medical records, vaccinations, and scan locations seeded`);
}

// Seeds one demo billing record for an owner's dog, linked to its most recent
// (current) medical record. No-op if a billing record already exists for that pet.
async function seedBillingForOwner(
  owner: InstanceType<typeof User>,
  vet: InstanceType<typeof User>,
  clinicId: mongoose.Types.ObjectId,
  clinicBranchId: mongoose.Types.ObjectId,
  scenario: (typeof BILLING_SCENARIOS)[number],
) {
  const dog = await Pet.findOne({ ownerId: owner._id, species: 'canine' });
  if (!dog) return;

  const existingBilling = await Billing.findOne({ petId: dog._id });
  if (existingBilling) return;

  const medRecord = await MedicalRecord.findOne({ petId: dog._id, isCurrent: true }).sort({ createdAt: -1 });
  if (!medRecord) return;

  const appt = medRecord.appointmentId ? await Appointment.findById(medRecord.appointmentId) : null;
  const serviceDate = appt?.date || medRecord.createdAt;

  const items = scenario.items.map((item) => ({ ...item, productServiceId: null }));
  const subtotal = items.reduce((sum, item) => sum + computeBillingItemTotal(item), 0);
  const totalAmountDue = Math.max(0, subtotal - scenario.discount);
  const isPaid = scenario.status === 'paid';

  const invoiceNumber = await generateNextInvoiceNumber(clinicId);

  await Billing.create({
    invoiceNumber,
    issueDateTime: new Date(),
    dueDate: serviceDate,
    ownerId: owner._id,
    petId: dog._id,
    vetId: vet._id,
    clinicId,
    clinicBranchId,
    medicalRecordId: medRecord._id,
    appointmentId: medRecord.appointmentId || null,
    items,
    subtotal,
    discount: scenario.discount,
    totalAmountDue,
    status: scenario.status,
    paidAt: isPaid ? serviceDate : null,
    amountPaid: isPaid ? totalAmountDue : null,
    paymentMethod: scenario.paymentMethod,
    serviceLabel: items.map((i) => i.name).join(', '),
    serviceDate,
    isFinalized: isPaid,
    finalizedAt: isPaid ? serviceDate : null,
    finalizedBy: isPaid ? vet._id : null,
  });

  console.log(`  ↳ Billing invoice ${invoiceNumber} seeded (${scenario.status})`);
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
    { label: 'baivet',   count: 25, clinic: baivetClinic,   branch: baivetBranch,   vet: baivetVet,   coord: CLINIC_COORDS.baivet },
    { label: 'external', count: 45, clinic: externalClinic, branch: externalBranch, vet: externalVet, coord: CLINIC_COORDS.external },
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
        group.coord,
      );

      const billingScenarioIdx = BILLING_PLAN[`${group.label}-${n}`];
      if (billingScenarioIdx !== undefined) {
        await seedBillingForOwner(
          owner,
          group.vet,
          group.clinic._id as mongoose.Types.ObjectId,
          group.branch._id as mongoose.Types.ObjectId,
          BILLING_SCENARIOS[billingScenarioIdx],
        );
      }

      globalIdx++;
    }
  }

  console.log('\n✅ UAT seed complete. 70 accounts ready.');
  console.log('   Password for all accounts: UatTest123!');
  console.log('   Baivet   emails: uat-baivet-01@pawsync.dev … uat-baivet-25@pawsync.dev');
  console.log('   External emails: uat-external-01@pawsync.dev … uat-external-45@pawsync.dev');
  console.log('   Each pet has 3 medical records, 3 shared diagnostic reports, 2 appointments, 2 vaccinations, and 3 scan locations.');
  console.log('   5 demo billing invoices were seeded (uat-baivet-01..03, uat-external-01..02).');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
