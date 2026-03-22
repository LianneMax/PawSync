import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from './helpers/db';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import User from '../models/User';
import Pet from '../models/Pet';
import ConfinementRecord from '../models/ConfinementRecord';
import Billing from '../models/Billing';
import {
  listConfinementMonitoringEntries,
  createConfinementMonitoringEntry,
  resolveConfinementMonitoringAlert,
} from '../controllers/confinementController';

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/clinicAdminAlertService', () => ({
  alertClinicAdmins: jest.fn().mockResolvedValue(undefined),
}));

type SeedState = {
  clinicId: string;
  branchId: string;
  vetId: string;
  adminId: string;
  ownerId: string;
  petId: string;
  confinementRecordId: string;
  billingId: string;
};

let seed: SeedState;

function buildApp(userType: 'veterinarian' | 'clinic-admin', userId: string) {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId,
      email: userType === 'veterinarian' ? 'vet@test.com' : 'admin@test.com',
      userType,
      clinicId: seed.clinicId,
      clinicBranchId: seed.branchId,
      isMainBranch: true,
    };
    next();
  });

  app.get('/api/confinement/:id/monitoring', listConfinementMonitoringEntries);
  app.post('/api/confinement/:id/monitoring', createConfinementMonitoringEntry);
  app.patch('/api/confinement/:id/monitoring/:entryId/resolve-alert', resolveConfinementMonitoringAlert);

  return app;
}

const basePayload = {
  entryType: 'daily',
  recordedAt: new Date().toISOString(),
  temperature: 38.6,
  heartRate: 120,
  respiratoryRate: 24,
  weight: 5.2,
  hydrationStatus: 'adequate',
  appetite: 'good',
  painScore: 2,
  clinicalNotes: 'Patient stable and responsive.',
  clinicalFlag: 'normal',
  followUpAction: 'watch',
};

async function seedBaseData(): Promise<SeedState> {
  const clinic = await new Clinic({ name: 'Monitoring Test Clinic' }).save();
  const branch = await new ClinicBranch({
    clinicId: clinic._id,
    name: 'Main Branch',
    address: '123 Clinic Street',
  }).save();

  const vet = await new User({
    email: 'vet@test.com',
    firstName: 'Vet',
    lastName: 'User',
    userType: 'veterinarian',
    clinicId: clinic._id,
    clinicBranchId: branch._id,
    isVerified: true,
  } as any).save();

  const admin = await new User({
    email: 'admin@test.com',
    firstName: 'Clinic',
    lastName: 'Admin',
    userType: 'clinic-admin',
    clinicId: clinic._id,
    clinicBranchId: branch._id,
    isVerified: true,
  } as any).save();

  const owner = await new User({
    email: 'owner@test.com',
    firstName: 'Pet',
    lastName: 'Owner',
    userType: 'pet-owner',
    isVerified: true,
  } as any).save();

  const pet = await new Pet({
    ownerId: owner._id,
    name: 'Mochi',
    species: 'feline',
    breed: 'Persian',
    sex: 'female',
    dateOfBirth: new Date('2021-01-01'),
    weight: 4.8,
    sterilization: 'spayed',
  }).save();

  const confinementRecord = await new ConfinementRecord({
    petId: pet._id,
    vetId: vet._id,
    clinicId: clinic._id,
    clinicBranchId: branch._id,
    reason: 'Post-op monitoring',
    notes: 'Admitted for observation',
    admissionDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'admitted',
  }).save();

  const billing = await new Billing({
    ownerId: owner._id,
    petId: pet._id,
    vetId: vet._id,
    clinicId: clinic._id,
    clinicBranchId: branch._id,
    medicalRecordId: null,
    confinementRecordId: confinementRecord._id,
    appointmentId: null,
    items: [{ name: 'Confinement', type: 'Service', unitPrice: 500, quantity: 1 }],
    subtotal: 500,
    discount: 0,
    totalAmountDue: 500,
    status: 'pending_payment',
    serviceLabel: 'Confinement',
    serviceDate: new Date(),
  }).save();

  await ConfinementRecord.findByIdAndUpdate(confinementRecord._id, { $set: { billingId: billing._id } });

  return {
    clinicId: clinic._id.toString(),
    branchId: branch._id.toString(),
    vetId: vet._id.toString(),
    adminId: admin._id.toString(),
    ownerId: owner._id.toString(),
    petId: pet._id.toString(),
    confinementRecordId: confinementRecord._id.toString(),
    billingId: billing._id.toString(),
  };
}

beforeAll(async () => {
  await setupTestDb();
});

beforeEach(async () => {
  await clearCollections();
  seed = await seedBaseData();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('Confinement monitoring endpoints', () => {
  it('allows veterinarian to create daily monitoring entry', async () => {
    const app = buildApp('veterinarian', seed.vetId);

    const res = await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send(basePayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.entry.entryType).toBe('daily');
  });

  it('prevents clinic-admin from creating daily entry but allows spot entry', async () => {
    const app = buildApp('clinic-admin', seed.adminId);

    const dailyRes = await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send(basePayload);

    expect(dailyRes.status).toBe(403);

    const spotRes = await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send({ ...basePayload, entryType: 'spot' });

    expect(spotRes.status).toBe(201);
    expect(spotRes.body.data.entry.entryType).toBe('spot');
  });

  it('requires override reason for out-of-range values', async () => {
    const app = buildApp('veterinarian', seed.vetId);

    const res = await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send({
        ...basePayload,
        temperature: 45,
        editReason: '',
      });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/outside expected range/i);
  });

  it('supports list endpoint and returns timeline entries', async () => {
    const app = buildApp('veterinarian', seed.vetId);

    await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send(basePayload)
      .expect(201);

    const listRes = await request(app)
      .get(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .expect(200);

    expect(listRes.body.status).toBe('SUCCESS');
    expect(Array.isArray(listRes.body.data.entries)).toBe(true);
    expect(listRes.body.data.entries.length).toBeGreaterThan(0);
  });

  it('does not change billing totals when monitoring entry is created', async () => {
    const app = buildApp('veterinarian', seed.vetId);

    const before = await Billing.findById(seed.billingId).lean();
    expect(before).not.toBeNull();

    const createRes = await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send(basePayload);

    expect(createRes.status).toBe(201);

    const after = await Billing.findById(seed.billingId).lean();
    expect(after).not.toBeNull();

    expect(after?.subtotal).toBe(before?.subtotal);
    expect(after?.totalAmountDue).toBe(before?.totalAmountDue);
    expect(after?.items.length).toBe(before?.items.length);
  });

  it('allows veterinarian to resolve critical alert', async () => {
    const app = buildApp('veterinarian', seed.vetId);

    const createRes = await request(app)
      .post(`/api/confinement/${seed.confinementRecordId}/monitoring`)
      .send({
        ...basePayload,
        clinicalFlag: 'critical',
        requiresImmediateReview: true,
        editReason: 'Critical due to sudden decline',
      })
      .expect(201);

    const entryId = createRes.body.data.entry._id;

    const resolveRes = await request(app)
      .patch(`/api/confinement/${seed.confinementRecordId}/monitoring/${entryId}/resolve-alert`)
      .send({ editReason: 'Reviewed after intervention' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.entry.alertResolved).toBe(true);
  });
});
