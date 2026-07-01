import type { Request, Response } from 'express';

// ─── Mock all external dependencies ──────────────────────────────────────────
// These factories run before imports, so they can only reference jest.fn() globals.

jest.mock('../models/MedicalRecord', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    exists: jest.fn(),
    updateMany: jest.fn(),
    updateOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../models/Pet', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('../models/User', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('../models/Appointment', () => ({
  __esModule: true,
  default: { findById: jest.fn(), exists: jest.fn() },
}));

jest.mock('../models/AssignedVet', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock('../models/Vaccination', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('../models/ConfinementRecord', () => ({
  __esModule: true,
  default: { findByIdAndUpdate: jest.fn() },
}));

jest.mock('../models/Billing', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('../models/ProductService', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('../models/VaccineType', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('../models/Referral', () => ({
  __esModule: true,
  default: { exists: jest.fn() },
}));

jest.mock('../models/ClinicBranch', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendMedicalRecordShared: jest.fn(),
  sendBillingPendingPayment: jest.fn(),
  sendPrescriptionEmail: jest.fn(),
}));

jest.mock('../services/pregnancyDomainService', () => ({
  getPregnancySnapshot: jest
    .fn()
    .mockResolvedValue({ status: 'not_pregnant', activeEpisode: null }),
  syncPregnancyFromMedicalRecord: jest.fn(),
  getPregnancyEpisodeHistory: jest.fn(),
}));

jest.mock('../utils/confinementPricing', () => ({
  calculateConfinementDailyPrice: jest.fn(),
}));

// ─── Imports (after mocks so modules are intercepted) ────────────────────────

import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import User from '../models/User';
import Appointment from '../models/Appointment';
import AssignedVet from '../models/AssignedVet';
import Vaccination from '../models/Vaccination';

import {
  createMedicalRecord,
  toggleShareRecord,
  createFollowUp,
  getVaccinationsByPet,
} from '../controllers/medicalRecordController';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function buildRes(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function buildReq(overrides: {
  user?: Record<string, string> | null;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
} = {}): Request {
  return {
    user: { userId: 'vet-111', userType: 'veterinarian' },
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

/**
 * Returns an object that behaves as both a thenable (awaitable) and a
 * chainable mongoose query (.populate / .select / .sort return `this`).
 * Resolves to `value` when awaited at any point in the chain.
 */
function chainable(value: unknown) {
  const q: any = {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
    then: (onfulfilled: any, onrejected?: any) =>
      Promise.resolve(value).then(onfulfilled, onrejected),
    catch: (onrejected: any) => Promise.resolve(value).catch(onrejected),
    finally: (onfinally: any) => Promise.resolve(value).finally(onfinally),
  };
  return q;
}

function buildPet(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'pet-001',
    ownerId: { toString: () => 'owner-999' },
    isAlive: true,
    status: 'active',
    ...overrides,
  };
}

function buildRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'rec-001',
    petId: 'pet-001',
    ownerId: null, // null prevents share-notification side-effects in toggle tests
    vetId: { toString: () => 'vet-111' },
    clinicId: null,
    isCurrent: true,
    sharedWithOwner: false,
    followUps: [] as any[],
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

// ─── createMedicalRecord ─────────────────────────────────────────────────────

describe('createMedicalRecord', () => {
  it('returns 401 when request has no authenticated user', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when appointmentId is provided but appointment does not exist', async () => {
    (Appointment.findById as jest.Mock).mockReturnValue(chainable(null));
    const req = buildReq({ body: { appointmentId: 'appt-ghost' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ERROR', message: 'Appointment not found' }),
    );
  });

  it('returns 409 when a medical record already exists for the appointment (BR-MR-06)', async () => {
    (Appointment.findById as jest.Mock).mockReturnValue(
      chainable({
        petId: { toString: () => 'pet-001' },
        clinicId: { toString: () => 'clinic-001' },
        clinicBranchId: null,
        vetId: { toString: () => 'vet-111' },
        isEmergency: false,
        notes: '',
      }),
    );
    (MedicalRecord.findOne as jest.Mock).mockResolvedValue({ _id: 'rec-existing' });
    const req = buildReq({ body: { appointmentId: 'appt-001' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ERROR', data: { recordId: 'rec-existing' } }),
    );
  });

  it('returns 404 when pet does not exist', async () => {
    (Pet.findById as jest.Mock).mockReturnValue(chainable(null));
    const req = buildReq({ body: { petId: 'pet-ghost' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ERROR', message: 'Pet not found' }),
    );
  });

  it('returns 403 when pet is deceased', async () => {
    (Pet.findById as jest.Mock).mockReturnValue(
      chainable(
        buildPet({ isAlive: false, status: 'deceased', deceasedAt: new Date('2024-01-15') }),
      ),
    );
    const req = buildReq({ body: { petId: 'pet-001' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // Shared setup for happy-path tests
  function setupCreateSuccess() {
    (Pet.findById as jest.Mock).mockReturnValue(chainable(buildPet()));
    (User.findById as jest.Mock).mockReturnValue(
      chainable({ firstName: 'Dr', lastName: 'Smith' }),
    );
    (MedicalRecord.updateMany as jest.Mock).mockResolvedValue({});
    (MedicalRecord.create as jest.Mock).mockResolvedValue({ _id: 'rec-new' });
    (MedicalRecord.findById as jest.Mock).mockReturnValue(
      chainable({ toObject: () => ({ _id: 'rec-new', images: [] }) }),
    );
  }

  it('marks all previous current records as historical before saving new one (BR-MR-01)', async () => {
    setupCreateSuccess();
    const req = buildReq({ body: { petId: 'pet-001' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(MedicalRecord.updateMany).toHaveBeenCalledWith(
      { petId: 'pet-001', isCurrent: true },
      { isCurrent: false },
    );
  });

  it('creates new record with isCurrent=true (BR-MR-01)', async () => {
    setupCreateSuccess();
    const req = buildReq({ body: { petId: 'pet-001' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(MedicalRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ isCurrent: true }),
    );
  });

  it('uses the requesting vet userId as vetId, not a body-supplied value (BR-MR-02)', async () => {
    setupCreateSuccess();
    const req = buildReq({
      body: { petId: 'pet-001', vetId: 'body-supplied-should-be-ignored' },
      user: { userId: 'vet-999', userType: 'veterinarian' },
    });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(MedicalRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ vetId: 'vet-999' }),
    );
  });

  it('does not set sharedWithOwner=true on new records (BR-MR-05)', async () => {
    setupCreateSuccess();
    const req = buildReq({ body: { petId: 'pet-001' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(MedicalRecord.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ sharedWithOwner: true }),
    );
  });

  it('returns 201 with record on success', async () => {
    setupCreateSuccess();
    const req = buildReq({ body: { petId: 'pet-001' } });
    const res = buildRes();

    await createMedicalRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SUCCESS',
        data: expect.objectContaining({ record: expect.any(Object) }),
      }),
    );
  });
});

// ─── toggleShareRecord ───────────────────────────────────────────────────────

describe('toggleShareRecord', () => {
  it('returns 401 when request has no authenticated user', async () => {
    const req = buildReq({ user: null, params: { id: 'rec-001' } });
    const res = buildRes();

    await toggleShareRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when record does not exist', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(null);
    const req = buildReq({ params: { id: 'rec-ghost' } });
    const res = buildRes();

    await toggleShareRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when a non-attending vet tries to share the record', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(
      buildRecord({ vetId: { toString: () => 'other-vet-222' } }),
    );
    const req = buildReq({
      params: { id: 'rec-001' },
      user: { userId: 'vet-111', userType: 'veterinarian' },
    });
    const res = buildRes();

    await toggleShareRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('sets sharedWithOwner=true and returns 200 when shared=true (BR-MR-05)', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(
      buildRecord({ sharedWithOwner: false }),
    );
    (MedicalRecord.updateOne as jest.Mock).mockResolvedValue({});
    const req = buildReq({ params: { id: 'rec-001' }, body: { shared: true } });
    const res = buildRes();

    await toggleShareRecord(req, res);

    expect(MedicalRecord.updateOne).toHaveBeenCalledWith(
      { _id: 'rec-001' },
      { $set: { sharedWithOwner: true } },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sharedWithOwner: true } }),
    );
  });

  it('sets sharedWithOwner=false and returns 200 when shared=false', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(
      buildRecord({ sharedWithOwner: true }),
    );
    (MedicalRecord.updateOne as jest.Mock).mockResolvedValue({});
    const req = buildReq({ params: { id: 'rec-001' }, body: { shared: false } });
    const res = buildRes();

    await toggleShareRecord(req, res);

    expect(MedicalRecord.updateOne).toHaveBeenCalledWith(
      { _id: 'rec-001' },
      { $set: { sharedWithOwner: false } },
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sharedWithOwner: false } }),
    );
  });

  it('toggles current sharedWithOwner when no shared param is provided', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(
      buildRecord({ sharedWithOwner: true }),
    );
    (MedicalRecord.updateOne as jest.Mock).mockResolvedValue({});
    const req = buildReq({ params: { id: 'rec-001' }, body: {} });
    const res = buildRes();

    await toggleShareRecord(req, res);

    // sharedWithOwner was true → toggled to false
    expect(MedicalRecord.updateOne).toHaveBeenCalledWith(
      { _id: 'rec-001' },
      { $set: { sharedWithOwner: false } },
    );
  });
});

// ─── createFollowUp ──────────────────────────────────────────────────────────

describe('createFollowUp', () => {
  it('returns 401 when request has no authenticated user', async () => {
    const req = buildReq({ user: null, params: { id: 'rec-001' } });
    const res = buildRes();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when record does not exist', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(null);
    const req = buildReq({
      params: { id: 'rec-ghost' },
      body: { ownerObservations: 'Pet is better' },
    });
    const res = buildRes();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when record is not the active current record', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(
      buildRecord({ isCurrent: false }),
    );
    const req = buildReq({
      params: { id: 'rec-001' },
      body: { ownerObservations: 'Pet is better' },
    });
    const res = buildRes();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Follow-up records can only be added to the active medical record',
      }),
    );
  });

  it('returns 403 when a non-attending vet tries to add a follow-up', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(
      buildRecord({ vetId: { toString: () => 'other-vet-222' } }),
    );
    const req = buildReq({
      params: { id: 'rec-001' },
      user: { userId: 'vet-111', userType: 'veterinarian' },
      body: { ownerObservations: 'Pet is better' },
    });
    const res = buildRes();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when ownerObservations is blank', async () => {
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(buildRecord());
    const req = buildReq({
      params: { id: 'rec-001' },
      body: { ownerObservations: '   ' },
    });
    const res = buildRes();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Owner observations are required' }),
    );
  });

  it('pushes follow-up with correct fields, saves record, and returns 201', async () => {
    const pushSpy = jest.fn();
    // map() must return an array of objects with .toObject() so the controller can serialize them
    const mockFollowUpDoc = {
      toObject: () => ({
        _id: 'fu-001',
        ownerObservations: 'Eating well',
        vetNotes: 'Recovered',
        sharedWithOwner: false,
      }),
      media: [],
    };
    const record = buildRecord({
      followUps: { push: pushSpy, map: jest.fn().mockReturnValue([mockFollowUpDoc]) },
    });
    (MedicalRecord.findById as jest.Mock).mockResolvedValue(record);

    const req = buildReq({
      params: { id: 'rec-001' },
      body: {
        ownerObservations: 'Eating well',
        vetNotes: 'Recovered',
        sharedWithOwner: false,
      },
    });
    const res = buildRes();

    await createFollowUp(req, res);

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        vetId: 'vet-111',
        ownerObservations: 'Eating well',
        vetNotes: 'Recovered',
        sharedWithOwner: false,
      }),
    );
    expect(record.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ─── getVaccinationsByPet ────────────────────────────────────────────────────

describe('getVaccinationsByPet', () => {
  it('returns 401 when request has no authenticated user', async () => {
    const req = buildReq({ user: null, params: { petId: 'pet-001' } });
    const res = buildRes();

    await getVaccinationsByPet(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when pet does not exist', async () => {
    (Pet.findById as jest.Mock).mockReturnValue(chainable(null));
    const req = buildReq({ params: { petId: 'pet-ghost' } });
    const res = buildRes();

    await getVaccinationsByPet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not the owner, an assigned vet, or clinic-admin', async () => {
    (Pet.findById as jest.Mock).mockReturnValue(chainable(buildPet())); // ownerId → 'owner-999'
    (AssignedVet.findOne as jest.Mock).mockResolvedValue(null);
    (MedicalRecord.exists as jest.Mock).mockResolvedValue(null);
    const req = buildReq({
      params: { petId: 'pet-001' },
      user: { userId: 'stranger-999', userType: 'veterinarian' },
    });
    const res = buildRes();

    await getVaccinationsByPet(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns only vaccinations whose linked record has stage=completed', async () => {
    // Make the requesting user the pet owner so auth passes without vet-assignment mocks
    (Pet.findById as jest.Mock).mockReturnValue(
      chainable(buildPet({ ownerId: { toString: () => 'owner-999' } })),
    );
    const rawVaccinations = [
      { vaccineName: 'Rabies',  medicalRecordId: { stage: 'completed'    } },
      { vaccineName: 'Parvo',   medicalRecordId: { stage: 'pre_procedure' } },
      { vaccineName: 'FVRCP',   medicalRecordId: null                      },
    ];
    (Vaccination.find as jest.Mock).mockReturnValue(chainable(rawVaccinations));

    const req = buildReq({
      params: { petId: 'pet-001' },
      user: { userId: 'owner-999', userType: 'owner' },
    });
    const res = buildRes();

    await getVaccinationsByPet(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          vaccinations: [
            { vaccineName: 'Rabies', medicalRecordId: { stage: 'completed' } },
          ],
        },
      }),
    );
  });
});
