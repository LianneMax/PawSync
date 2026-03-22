/**
 * Integration tests for guest intake appointment creation.
 *
 * Strategy:
 * - Use mongodb-memory-server for a real in-process MongoDB instance.
 * - Mount only the three guest-intake controller functions on a minimal
 *   Express app (auth middleware bypassed via a req.user injection shim).
 * - Mock emailService so no real emails are sent.
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearCollections } from './helpers/db';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import User from '../models/User';
import Appointment from '../models/Appointment';

// ── Mock emailService before importing the controller ─────────────────────────
jest.mock('../services/emailService', () => ({
  sendGuestClaimInviteEmail: jest.fn().mockResolvedValue(undefined),
  sendAppointmentBooked: jest.fn().mockResolvedValue(undefined),
  sendAppointmentCancelled: jest.fn().mockResolvedValue(undefined),
  // Needed by authController (claim-guest endpoint)
  getResend: jest.fn().mockReturnValue({ emails: { send: jest.fn().mockResolvedValue({}) } }),
  FROM: 'noreply@test.pawsync.com',
}));

// Import after mock so the controller picks up the mocked version.
import {
  createGuestIntakeAppointment,
  sendGuestClaimInvite,
  updateGuestEmail,
} from '../controllers/appointmentController';
import { claimGuestAccount } from '../controllers/authController';
import { sendGuestClaimInviteEmail } from '../services/emailService';

// ── Shared test state ─────────────────────────────────────────────────────────
let clinicId: string;
let branchId: string;
let adminUserId: string;

// A future date that is always valid for appointment scheduling.
const futureDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
})();

const BASE_PAYLOAD = {
  ownerFirstName: 'Maria',
  ownerLastName: 'Santos',
  ownerEmail: '',
  ownerContact: '',
  petName: 'Fluffy',
  petSpecies: 'feline',
  petBreed: 'Persian',
  petSex: 'female',
  petDateOfBirth: '2021-01-15',
  petWeight: 4.5,
  petSterilization: 'spayed',
  mode: 'face-to-face',
  types: ['basic-grooming'],
  date: futureDate,
  startTime: '09:00',
  endTime: '09:30',
  isWalkIn: true,
  isEmergency: false,
};

// ── Build a minimal test app ──────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());

  // Inject a fake clinic-admin user so auth middleware is not needed.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId: adminUserId,
      email: 'admin@testclinic.com',
      userType: 'clinic-admin',
      clinicId,
    };
    next();
  });

  app.post('/api/appointments/clinic/guest-intake', createGuestIntakeAppointment);
  app.post('/api/appointments/clinic/guest/:ownerId/send-claim-invite', sendGuestClaimInvite);
  app.patch('/api/appointments/clinic/guest/:ownerId/update-email', updateGuestEmail);
  app.post('/api/auth/claim-guest', claimGuestAccount);

  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a guest intake and return the guest owner's _id + the raw claimToken. */
async function createGuestAndGetToken(app: ReturnType<typeof buildApp>, email: string) {
  const res = await request(app)
    .post('/api/appointments/clinic/guest-intake')
    .send({ ...BASE_PAYLOAD, ownerEmail: email, clinicBranchId: branchId });
  expect(res.status).toBe(201);

  const ownerId = res.body.data.guestOwner._id as string;

  // claimToken is select:false — fetch it directly from DB.
  const guest = await User.findById(ownerId).select('+claimToken +claimTokenExpires');
  expect(guest).not.toBeNull();
  expect(guest!.claimToken).toBeTruthy();

  return { ownerId, claimToken: guest!.claimToken as string };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  await setupTestDb();

  // Seed clinic + branch
  const clinic = await Clinic.create({ name: 'Test Clinic' });
  clinicId = clinic._id.toString();

  const branch = await ClinicBranch.create({
    clinicId: clinic._id,
    name: 'Main Branch',
    address: '123 Vet Street',
  });
  branchId = branch._id.toString();

  // Seed admin user (just needs an _id for audit logs)
  const admin = await User.create({
    email: 'admin@testclinic.com',
    firstName: 'Admin',
    lastName: 'User',
    userType: 'clinic-admin',
    clinicId: clinic._id,
    isVerified: true,
  } as any);
  adminUserId = (admin as any)._id.toString();
});

afterAll(async () => {
  await teardownTestDb();
});

afterEach(async () => {
  // Clear all non-admin users and appointments between tests.
  // We also delete claimed users (isGuest: false after claim) to avoid
  // contactNumberNormalized: null conflicts in subsequent tests.
  await User.deleteMany({ email: { $ne: 'admin@testclinic.com' } });
  await Appointment.deleteMany({});
  (sendGuestClaimInviteEmail as jest.Mock).mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. New email → succeeds, no false duplicate error
// ─────────────────────────────────────────────────────────────────────────────
describe('Guest intake — new email succeeds', () => {
  it('creates owner + pet + appointment and returns 201', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'brand-new@example.com',
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.guestOwner.isGuest).toBe(true);
    expect(res.body.data.guestOwner.email).toBe('brand-new@example.com');
    expect(res.body.data.guestPet.name).toBe('Fluffy');
    expect(res.body.data.appointment).toBeDefined();
  });

  it('auto-sends claim invite and returns inviteSent: true', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'auto-invite@example.com',
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.inviteSent).toBe(true);
    expect(res.body.data.guestOwner.claimStatus).toBe('invited');
    expect(sendGuestClaimInviteEmail).toHaveBeenCalledTimes(1);
    expect(sendGuestClaimInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ ownerEmail: 'auto-invite@example.com' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Existing registered-owner email → blocked with correct message
// ─────────────────────────────────────────────────────────────────────────────
describe('Guest intake — existing registered-owner email', () => {
  it('returns 409 with "pet owner account" message', async () => {
    await User.create({
      email: 'real-owner@example.com',
      firstName: 'Real',
      lastName: 'Owner',
      userType: 'pet-owner',
      isGuest: false,
    } as any);

    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'real-owner@example.com',
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/pet owner account.*already exists/i);
    expect(res.body.existingOwnerId).toBeDefined();

    await User.deleteMany({ email: 'real-owner@example.com' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Existing guest/unclaimed email → blocked with correct message
// ─────────────────────────────────────────────────────────────────────────────
describe('Guest intake — existing guest email', () => {
  it('returns 409 with "guest record" message', async () => {
    await User.create({
      email: 'existing-guest@example.com',
      firstName: 'Existing',
      lastName: 'Guest',
      userType: 'pet-owner',
      isGuest: true,
      claimStatus: 'unclaimed',
      guestClinicId: clinicId,
    } as any);

    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'existing-guest@example.com',
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/guest record.*already exists/i);
    expect(res.body.existingOwnerId).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Email normalisation — mixed case / whitespace must not create false duplicate
// ─────────────────────────────────────────────────────────────────────────────
describe('Guest intake — email normalisation', () => {
  it('treats "Test@Example.COM" and "test@example.com" as the same', async () => {
    const app = buildApp();

    // First creation with lowercase form should succeed.
    const first = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: 'norm@example.com', clinicBranchId: branchId });
    expect(first.status).toBe(201);

    // Second attempt with a differently-cased version of the same address.
    const second = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: 'NORM@EXAMPLE.COM', clinicBranchId: branchId });
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already exists/i);
  });

  it('trims surrounding whitespace before lookup', async () => {
    const app = buildApp();
    const first = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: 'trim@example.com', clinicBranchId: branchId });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: '  trim@example.com  ', clinicBranchId: branchId });
    expect(second.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. No email → appointment created, marked unclaimable, invite not sent
// ─────────────────────────────────────────────────────────────────────────────
describe('Guest intake — no email provided', () => {
  it('creates appointment with unclaimable status and does not send invite', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: '', clinicBranchId: branchId });

    expect(res.status).toBe(201);
    expect(res.body.data.guestOwner.claimStatus).toBe('unclaimable');
    expect(res.body.data.guestOwner.email).toBeNull();
    expect(res.body.data.inviteSent).toBe(false);
    expect(sendGuestClaimInviteEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Update Email + Send Invite works end-to-end
// ─────────────────────────────────────────────────────────────────────────────
describe('Update Email + Send Invite flow', () => {
  it('updates email, transitions to unclaimed, then sends invite', async () => {
    const app = buildApp();

    // Create an unclaimable guest (no email).
    const createRes = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: '', clinicBranchId: branchId });
    expect(createRes.status).toBe(201);

    const ownerId = createRes.body.data.guestOwner._id;

    // Update email + send invite in one call.
    const updateRes = await request(app)
      .patch(`/api/appointments/clinic/guest/${ownerId}/update-email`)
      .send({ email: 'added-later@example.com', sendInvite: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.claimStatus).toBe('invited');
    expect(sendGuestClaimInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ ownerEmail: 'added-later@example.com' }),
    );
  });

  it('blocks sending invite when guest has no real email', async () => {
    const app = buildApp();

    const createRes = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: '', clinicBranchId: branchId });
    expect(createRes.status).toBe(201);

    const ownerId = createRes.body.data.guestOwner._id;

    const inviteRes = await request(app)
      .post(`/api/appointments/clinic/guest/${ownerId}/send-claim-invite`);

    expect(inviteRes.status).toBe(400);
    expect(inviteRes.body.message).toMatch(/no email address on file/i);
    expect(sendGuestClaimInviteEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Duplicate contact number → targeted error, not "email already exists"
// ─────────────────────────────────────────────────────────────────────────────
describe('Guest intake — contact number duplicate detected early', () => {
  it('returns 409 with contact-number message when phone matches existing user', async () => {
    // Create an existing user with a known contact number.
    // Use a unique email to avoid the email-duplicate path.
    await User.create({
      email: 'other-user@example.com',
      firstName: 'Other',
      lastName: 'User',
      userType: 'pet-owner',
      contactNumber: '09123456789',
      contactNumberNormalized: '09123456789',
    } as any);

    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'fresh-email@example.com', // email is unique
        ownerContact: '09123456789',            // phone is taken
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(409);
    // Must NOT say "email already exists" — that would be the old misleading message.
    expect(res.body.message).not.toMatch(/email already exists/i);
    expect(res.body.message).toMatch(/contact number/i);

    await User.deleteMany({ email: 'other-user@example.com' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Appointment → appointment record created and linked correctly
// ─────────────────────────────────────────────────────────────────────────────
describe('System-flow continuity', () => {
  it('appointment document references the guest owner and pet', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'flow-test@example.com',
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(201);

    const apptId = res.body.data.appointment._id;
    const appt = await Appointment.findById(apptId);

    expect(appt).not.toBeNull();
    expect(appt!.ownerId.toString()).toBe(res.body.data.guestOwner._id);
    expect(appt!.petId.toString()).toBe(res.body.data.guestPet._id);
    expect(appt!.clinicId.toString()).toBe(clinicId);
    expect(appt!.status).toBe('confirmed');
  });

  it('guest owner document can be found and has isGuest flag', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({
        ...BASE_PAYLOAD,
        ownerEmail: 'owner-flag@example.com',
        clinicBranchId: branchId,
      });

    expect(res.status).toBe(201);

    const ownerId = res.body.data.guestOwner._id;
    const owner = await User.findById(ownerId);

    expect(owner).not.toBeNull();
    expect(owner!.isGuest).toBe(true);
    expect(owner!.userType).toBe('pet-owner');
    expect(owner!.guestClinicId!.toString()).toBe(clinicId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Claim invite email contains a valid /signup URL (not a broken /claim/...)
// ─────────────────────────────────────────────────────────────────────────────
describe('Claim invite email — URL format', () => {
  it('sends a claimUrl pointing to /signup with query params, not /claim/...', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: 'url-check@example.com', clinicBranchId: branchId });
    expect(res.status).toBe(201);

    expect(sendGuestClaimInviteEmail).toHaveBeenCalledTimes(1);

    const callArg = (sendGuestClaimInviteEmail as jest.Mock).mock.calls[0][0];

    // Must include a claimToken param — i.e. route to /signup?claimToken=...
    expect(callArg).toHaveProperty('claimToken');
    expect(typeof callArg.claimToken).toBe('string');
    expect(callArg.claimToken.length).toBeGreaterThan(0);

    // The email service is responsible for building the URL; we verify the params
    // it receives are suitable for the /signup?claimToken=...&claimEmail=... shape.
    expect(callArg).toHaveProperty('ownerEmail', 'url-check@example.com');
    expect(callArg).toHaveProperty('ownerFirstName', 'Maria');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Successful claim — guest upgraded in-place, JWT returned
// ─────────────────────────────────────────────────────────────────────────────
describe('Claim guest account — success', () => {
  it('upgrades guest to full account, returns 200 + JWT', async () => {
    const app = buildApp();
    const { ownerId, claimToken } = await createGuestAndGetToken(app, 'claim-success@example.com');

    const res = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken, firstName: 'Maria', lastName: 'Santos', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.id).toBe(ownerId);

    // Verify DB state directly.
    const upgraded = await User.findById(ownerId);
    expect(upgraded!.isGuest).toBe(false);
    expect(upgraded!.claimStatus).toBe('claimed');
    expect(upgraded!.emailVerified).toBe(true);
  });

  it('clears claimToken and claimTokenExpires after claim', async () => {
    const app = buildApp();
    const { ownerId, claimToken } = await createGuestAndGetToken(app, 'clear-token@example.com');

    await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken, firstName: 'Maria', lastName: 'Santos', password: 'password123' });

    const upgraded = await User.findById(ownerId).select('+claimToken +claimTokenExpires');
    expect(upgraded!.claimToken).toBeNull();
    expect(upgraded!.claimTokenExpires).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Pets and appointments remain intact after claim (same _id refs)
// ─────────────────────────────────────────────────────────────────────────────
describe('Claim guest account — data integrity', () => {
  it('all pets and appointments still reference the same owner _id after claim', async () => {
    const app = buildApp();
    const { ownerId, claimToken } = await createGuestAndGetToken(app, 'integrity@example.com');

    // Confirm appointment was created with the guest _id.
    const apptsBefore = await Appointment.find({ ownerId });
    expect(apptsBefore.length).toBe(1);

    // Claim the account.
    const res = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken, firstName: 'Maria', lastName: 'Santos', password: 'password123' });
    expect(res.status).toBe(200);

    // The same _id is still referenced — no new User was created.
    const apptsAfter = await Appointment.find({ ownerId });
    expect(apptsAfter.length).toBe(1);
    expect(apptsAfter[0]._id.toString()).toBe(apptsBefore[0]._id.toString());

    // No duplicate User documents.
    const userCount = await User.countDocuments({ email: 'integrity@example.com' });
    expect(userCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Invalid / expired token rejected
// ─────────────────────────────────────────────────────────────────────────────
describe('Claim guest account — invalid token', () => {
  it('returns 400 for a completely unknown token', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken: 'deadbeefdeadbeefdeadbeef0000000000000000', firstName: 'A', lastName: 'B', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('ERROR');
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 400 for an expired token', async () => {
    // Manually create a guest with an expired claimToken.
    const expiredGuest = (await User.create({
      email: 'expired-token@example.com',
      firstName: 'Expired',
      lastName: 'Guest',
      userType: 'pet-owner',
      isGuest: true,
      claimStatus: 'invited',
      claimToken: 'expiredtoken1234567890abcdef12345678',
      claimTokenExpires: new Date(Date.now() - 1000), // already in the past
      guestClinicId: clinicId,
    } as any)) as any;

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken: 'expiredtoken1234567890abcdef12345678', firstName: 'A', lastName: 'B', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('ERROR');

    await User.findByIdAndDelete(expiredGuest._id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Idempotency — second claim attempt on already-claimed user fails gracefully
// ─────────────────────────────────────────────────────────────────────────────
describe('Claim guest account — idempotency', () => {
  it('rejects a second claim attempt once the account is already claimed', async () => {
    const app = buildApp();
    const { claimToken } = await createGuestAndGetToken(app, 'idempotent@example.com');

    // First claim — should succeed.
    const first = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken, firstName: 'Maria', lastName: 'Santos', password: 'password123' });
    expect(first.status).toBe(200);

    // Second claim with the same token — token has been cleared, must fail.
    const second = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken, firstName: 'Maria', lastName: 'Santos', password: 'password123' });
    expect(second.status).toBe(400);
    expect(second.body.status).toBe('ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Standard register flow is unaffected (no regression)
// ─────────────────────────────────────────────────────────────────────────────
describe('Standard register flow — no regression', () => {
  it('missing required fields returns 400', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken: 'sometoken', firstName: '', lastName: 'Santos', password: 'pw123' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('ERROR');
  });

  it('password shorter than 6 chars returns 400', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/claim-guest')
      .send({ claimToken: 'sometoken', firstName: 'Maria', lastName: 'Santos', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 6/i);
  });

  it('guest intake for a new email still succeeds after claim tests', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/appointments/clinic/guest-intake')
      .send({ ...BASE_PAYLOAD, ownerEmail: 'regression@example.com', clinicBranchId: branchId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
  });
});
