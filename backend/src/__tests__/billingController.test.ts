import type { Request, Response } from 'express';

// ─── Mock external dependencies ───────────────────────────────────────────────

jest.mock('../models/Billing', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../models/User', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('../models/MedicalRecord', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../models/ConfinementRecord', () => ({
  __esModule: true,
  default: { findByIdAndUpdate: jest.fn() },
}));

jest.mock('../models/Appointment', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('../services/emailService', () => ({
  sendBillingPaidReceipt: jest.fn(),
}));

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/clinicAdminAlertService', () => ({
  alertClinicAdmins: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../controllers/medicalRecordController', () => ({
  syncBillingFromRecord: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/invoiceNumberService', () => ({
  generateNextInvoiceNumber: jest.fn().mockResolvedValue('000001'),
}));

jest.mock('../services/billingPdfService', () => ({
  generateBillingReceiptPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import Billing from '../models/Billing';
import MedicalRecord from '../models/MedicalRecord';
import { sendBillingPaidReceipt } from '../services/emailService';
import { alertClinicAdmins } from '../services/clinicAdminAlertService';

import {
  createBilling,
  listBillingsForClinic,
  listBillingsForVet,
  listMyInvoices,
  getBillingById,
  markBillingAsPaid,
  submitQrPaymentProof,
  downloadBillingPdf,
} from '../controllers/billingController';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRes(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function buildReq(overrides: {
  user?: Record<string, string | null> | null;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
} = {}): Request {
  return {
    user: { userId: 'admin-111', userType: 'clinic-admin', clinicId: 'clinic-001' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function chainable(value: unknown) {
  const q: any = {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
    then: (onfulfilled: any, onrejected?: any) =>
      Promise.resolve(value).then(onfulfilled, onrejected),
    catch: (onrejected: any) => Promise.resolve(value).catch(onrejected),
    finally: (onfinally: any) => Promise.resolve(value).finally(onfinally),
  };
  return q;
}

function buildBillingDoc(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    _id: 'billing-001',
    status: 'pending_payment',
    totalAmountDue: 1000,
    medicalRecordId: null,
    appointmentId: null,
    pendingQrApproval: false,
    isFinalized: false,
    qrPaymentProof: null,
    qrPaymentSubmittedAt: null,
    ownerId: { toString: () => 'owner-001' },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildPopulatedBilling(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'billing-001',
    invoiceNumber: '000001',
    status: 'pending_payment',
    totalAmountDue: 1500,
    subtotal: 1500,
    discount: 0,
    medicalRecordId: null,
    ownerId: {
      _id: 'owner-001',
      toString: () => 'owner-001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    },
    petId: { _id: 'pet-001', name: 'Buddy', species: 'dog' },
    vetId: { _id: 'vet-001', firstName: 'Dr', lastName: 'Smith' },
    clinicId: { _id: 'clinic-001', name: 'PawSync Clinic' },
    clinicBranchId: { _id: 'branch-001', name: 'Main Branch' },
    items: [{ name: 'Dental Cleaning', unitPrice: 1500, quantity: 1 }],
    serviceLabel: 'Dental Cleaning',
    paidAt: null,
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── createBilling ─────────────────────────────────────────────────────────────

describe('createBilling', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await createBilling(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when ownerId or petId is missing', async () => {
    const req = buildReq({ body: { ownerId: 'owner-001' } });
    const res = buildRes();
    await createBilling(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'ownerId and petId are required' }),
    );
  });

  it('creates billing with 201 and always sets status to pending_payment', async () => {
    const populated = buildPopulatedBilling();
    (Billing.findOne as jest.Mock).mockReturnValue(chainable(null));
    (Billing.create as jest.Mock).mockResolvedValue({ _id: 'billing-001' });
    (Billing.findById as jest.Mock).mockReturnValue(chainable(populated));

    const req = buildReq({
      body: {
        ownerId: 'owner-001',
        petId: 'pet-001',
        vetId: 'vet-001',
        items: [{ name: 'Dental Cleaning', unitPrice: 1500, quantity: 1 }],
        status: 'paid',
      },
    });
    const res = buildRes();
    await createBilling(req, res);

    expect(Billing.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_payment' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS' }));
  });

  it('returns 200 with existing billing when appointment already has one (idempotent)', async () => {
    const existing = buildPopulatedBilling();
    (Billing.findOne as jest.Mock).mockReturnValue(chainable(existing));

    const req = buildReq({
      body: { ownerId: 'owner-001', petId: 'pet-001', appointmentId: 'appt-001' },
    });
    const res = buildRes();
    await createBilling(req, res);

    expect(Billing.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Billing already exists for this appointment' }),
    );
  });

  it('computes subtotal and totalAmountDue from items and discount', async () => {
    (Billing.findOne as jest.Mock).mockReturnValue(chainable(null));
    (Billing.create as jest.Mock).mockResolvedValue({ _id: 'billing-001' });
    (Billing.findById as jest.Mock).mockReturnValue(chainable(buildPopulatedBilling()));

    const req = buildReq({
      body: {
        ownerId: 'owner-001',
        petId: 'pet-001',
        items: [
          { name: 'Dental Cleaning', unitPrice: 1000, quantity: 1 },
          { name: 'Consultation', unitPrice: 500, quantity: 2 },
        ],
        discount: 200,
      },
    });
    const res = buildRes();
    await createBilling(req, res);

    expect(Billing.create).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 2000, discount: 200, totalAmountDue: 1800 }),
    );
  });
});

// ─── listBillingsForClinic ─────────────────────────────────────────────────────

describe('listBillingsForClinic', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await listBillingsForClinic(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns paginated billings for clinic admin (billing page navigation)', async () => {
    const billings = [buildPopulatedBilling()];
    (Billing.find as jest.Mock).mockReturnValue(chainable(billings));
    (Billing.countDocuments as jest.Mock).mockResolvedValue(1);

    const req = buildReq({ query: { page: '1', limit: '20' } });
    const res = buildRes();
    await listBillingsForClinic(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('SUCCESS');
    expect(body.data.total).toBe(1);
  });

  it('passes status filter to query (running/pending/paid filter)', async () => {
    (Billing.find as jest.Mock).mockReturnValue(chainable([]));
    (Billing.countDocuments as jest.Mock).mockResolvedValue(0);

    const req = buildReq({ query: { status: 'pending_payment' } });
    const res = buildRes();
    await listBillingsForClinic(req, res);

    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_payment' }),
    );
  });

  it('filters by date range via query — no date in query returns all results', async () => {
    const billings = [buildPopulatedBilling()];
    (Billing.find as jest.Mock).mockReturnValue(chainable(billings));
    (Billing.countDocuments as jest.Mock).mockResolvedValue(1);

    const req = buildReq({ query: {} });
    const res = buildRes();
    await listBillingsForClinic(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.billings).toHaveLength(1);
  });

  it('searches by pet name from populated results (search by Pet ID)', async () => {
    const billings = [
      buildPopulatedBilling({ petId: { _id: 'pet-001', name: 'Buddy' } }),
      buildPopulatedBilling({ _id: 'billing-002', petId: { _id: 'pet-002', name: 'Max' } }),
    ];
    (Billing.find as jest.Mock).mockReturnValue(chainable(billings));
    (Billing.countDocuments as jest.Mock).mockResolvedValue(2);

    const req = buildReq({ query: { search: 'buddy' } });
    const res = buildRes();
    await listBillingsForClinic(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.billings).toHaveLength(1);
    expect((body.data.billings[0] as any).petId.name).toBe('Buddy');
  });
});

// ─── listBillingsForVet ────────────────────────────────────────────────────────

describe('listBillingsForVet', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await listBillingsForVet(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns billings scoped to the vet (running bill view)', async () => {
    const billings = [buildPopulatedBilling({ status: 'pending_payment' })];
    (Billing.find as jest.Mock).mockReturnValue(chainable(billings));

    const req = buildReq({
      user: { userId: 'vet-001', userType: 'veterinarian', clinicId: 'clinic-001' },
    });
    const res = buildRes();
    await listBillingsForVet(req, res);

    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ vetId: 'vet-001' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.billings[0].status).toBe('pending_payment');
  });

  it('filters by paid status so vet can check payment confirmation', async () => {
    const billings = [buildPopulatedBilling({ status: 'paid' })];
    (Billing.find as jest.Mock).mockReturnValue(chainable(billings));

    const req = buildReq({
      user: { userId: 'vet-001', userType: 'veterinarian', clinicId: 'clinic-001' },
      query: { status: 'paid' },
    });
    const res = buildRes();
    await listBillingsForVet(req, res);

    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ vetId: 'vet-001', status: 'paid' }),
    );
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.billings[0].status).toBe('paid');
  });
});

// ─── listMyInvoices ───────────────────────────────────────────────────────────

describe('listMyInvoices', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await listMyInvoices(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns newly delivered invoices scoped to owner', async () => {
    const invoices = [buildPopulatedBilling({ status: 'pending_payment' })];
    (Billing.find as jest.Mock).mockReturnValue(chainable(invoices));

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
    });
    const res = buildRes();
    await listMyInvoices(req, res);

    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-001' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.billings).toHaveLength(1);
  });

  it('filters by paid status so owner can check payment confirmation', async () => {
    (Billing.find as jest.Mock).mockReturnValue(chainable([]));

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      query: { status: 'paid' },
    });
    const res = buildRes();
    await listMyInvoices(req, res);

    expect(Billing.find).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-001', status: 'paid' }),
    );
  });
});

// ─── getBillingById ───────────────────────────────────────────────────────────

describe('getBillingById', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await getBillingById(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when billing not found', async () => {
    (Billing.findById as jest.Mock).mockReturnValue(chainable(null));

    const req = buildReq({ params: { id: 'nonexistent' } });
    const res = buildRes();
    await getBillingById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not owner, vet, or clinic staff', async () => {
    const billing = buildPopulatedBilling({
      ownerId: { toString: () => 'other-owner', _id: 'other-owner' },
      vetId: { _id: 'other-vet' },
      medicalRecordId: null,
    });
    (Billing.findById as jest.Mock).mockReturnValue(chainable(billing));

    const req = buildReq({
      user: { userId: 'random-user', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
    });
    const res = buildRes();
    await getBillingById(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns complete invoice for clinic admin', async () => {
    const billing = buildPopulatedBilling();
    (Billing.findById as jest.Mock).mockReturnValue(chainable(billing));

    const req = buildReq({ params: { id: 'billing-001' } });
    const res = buildRes();
    await getBillingById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('SUCCESS');
    expect(body.data.billing.invoiceNumber).toBe('000001');
  });

  it('returns invoice for the billing owner', async () => {
    const billing = buildPopulatedBilling({
      ownerId: {
        _id: 'owner-001',
        toString: () => 'owner-001',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      },
    });
    (Billing.findById as jest.Mock).mockReturnValue(chainable(billing));

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
    });
    const res = buildRes();
    await getBillingById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── markBillingAsPaid ────────────────────────────────────────────────────────

describe('markBillingAsPaid', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await markBillingAsPaid(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when billing not found', async () => {
    (Billing.findById as jest.Mock).mockResolvedValueOnce(null);

    const req = buildReq({ params: { id: 'nonexistent' } });
    const res = buildRes();
    await markBillingAsPaid(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when billing is already paid', async () => {
    const billing = buildBillingDoc({ status: 'paid' });
    (Billing.findById as jest.Mock).mockResolvedValueOnce(billing);

    const req = buildReq({ params: { id: 'billing-001' } });
    const res = buildRes();
    await markBillingAsPaid(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Billing is already marked as paid' }),
    );
  });

  it('returns 400 when amount paid is less than total due', async () => {
    const billing = buildBillingDoc({ totalAmountDue: 1000 });
    (Billing.findById as jest.Mock).mockResolvedValueOnce(billing);

    const req = buildReq({
      params: { id: 'billing-001' },
      body: { amountPaid: 500, paymentMethod: 'cash' },
    });
    const res = buildRes();
    await markBillingAsPaid(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('less than the total amount due') }),
    );
  });

  it('returns 400 when linked medical record is not in completed/confined stage', async () => {
    const billing = buildBillingDoc({ medicalRecordId: 'rec-001', totalAmountDue: 1000 });
    (Billing.findById as jest.Mock).mockResolvedValueOnce(billing);
    (MedicalRecord.findById as jest.Mock).mockReturnValueOnce(chainable({ stage: 'in_progress' }));

    const req = buildReq({
      params: { id: 'billing-001' },
      body: { amountPaid: 1000 },
    });
    const res = buildRes();
    await markBillingAsPaid(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('completed or the pet is admitted') }),
    );
  });

  it('marks billing paid, finalizes it, and sends receipt email', async () => {
    const billing = buildBillingDoc({ totalAmountDue: 1000 });
    const populated = buildPopulatedBilling({ status: 'paid', paidAt: new Date() });
    (Billing.findById as jest.Mock)
      .mockResolvedValueOnce(billing)
      .mockReturnValueOnce(chainable(populated));

    const req = buildReq({
      params: { id: 'billing-001' },
      body: { amountPaid: 1000, paymentMethod: 'cash' },
    });
    const res = buildRes();
    await markBillingAsPaid(req, res);

    expect(billing.status).toBe('paid');
    expect(billing.isFinalized).toBe(true);
    expect(billing.save).toHaveBeenCalled();
    expect(sendBillingPaidReceipt).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── submitQrPaymentProof ─────────────────────────────────────────────────────

describe('submitQrPaymentProof', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await submitQrPaymentProof(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when owner does not own the billing', async () => {
    const billing = buildBillingDoc({ ownerId: { toString: () => 'other-owner' } });
    (Billing.findById as jest.Mock).mockResolvedValueOnce(billing);

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
      body: { screenshot: 'data:image/png;base64,abc123' },
    });
    const res = buildRes();
    await submitQrPaymentProof(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when screenshot is missing (incomplete payment details)', async () => {
    const billing = buildBillingDoc({ ownerId: { toString: () => 'owner-001' } });
    (Billing.findById as jest.Mock).mockResolvedValueOnce(billing);

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
      body: {},
    });
    const res = buildRes();
    await submitQrPaymentProof(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Payment screenshot is required' }),
    );
  });

  it('returns 400 for invalid image format (e.g., .pdf file path)', async () => {
    const billing = buildBillingDoc({ ownerId: { toString: () => 'owner-001' } });
    (Billing.findById as jest.Mock).mockResolvedValueOnce(billing);

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
      body: { screenshot: 'payment_receipt.pdf' },
    });
    const res = buildRes();
    await submitQrPaymentProof(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid image format' }),
    );
  });

  it('accepts data:image/ data URL and sets pendingQrApproval', async () => {
    const billing = buildBillingDoc({ ownerId: { toString: () => 'owner-001' } });
    const populated = buildPopulatedBilling({ pendingQrApproval: true });
    (Billing.findById as jest.Mock)
      .mockResolvedValueOnce(billing)
      .mockReturnValueOnce(chainable(populated));

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
      body: { screenshot: 'data:image/png;base64,iVBORw0KGgo=' },
    });
    const res = buildRes();
    await submitQrPaymentProof(req, res);

    expect(billing.qrPaymentProof).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(billing.pendingQrApproval).toBe(true);
    expect(billing.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(alertClinicAdmins).toHaveBeenCalled();
  });

  it('accepts /uploads/ path as valid image proof', async () => {
    const billing = buildBillingDoc({ ownerId: { toString: () => 'owner-001' } });
    const populated = buildPopulatedBilling({ pendingQrApproval: true });
    (Billing.findById as jest.Mock)
      .mockResolvedValueOnce(billing)
      .mockReturnValueOnce(chainable(populated));

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
      body: { screenshot: '/uploads/qr-proof-20240101.png' },
    });
    const res = buildRes();
    await submitQrPaymentProof(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── downloadBillingPdf ───────────────────────────────────────────────────────

describe('downloadBillingPdf', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await downloadBillingPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when billing not found', async () => {
    (Billing.findById as jest.Mock).mockReturnValueOnce(chainable(null));

    const req = buildReq({ params: { id: 'nonexistent' } });
    const res = buildRes();
    await downloadBillingPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 for unauthorized user', async () => {
    const billing = buildPopulatedBilling({
      ownerId: { _id: { toString: () => 'other-owner' } },
      vetId: { _id: null },
    });
    (Billing.findById as jest.Mock).mockReturnValueOnce(chainable(billing));

    const req = buildReq({
      user: { userId: 'random-user', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
    });
    const res = buildRes();
    await downloadBillingPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('generates PDF and sets attachment header for clinic admin (export)', async () => {
    const billing = buildPopulatedBilling({
      ownerId: { _id: { toString: () => 'owner-001' }, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    });
    (Billing.findById as jest.Mock).mockReturnValueOnce(chainable(billing));

    const req = buildReq({
      params: { id: 'billing-001' },
      query: { layout: 'a4' },
    });
    const res = buildRes();
    await downloadBillingPdf(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment'),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('generates PDF for pet owner (download own invoice)', async () => {
    const billing = buildPopulatedBilling({
      ownerId: {
        _id: { toString: () => 'owner-001' },
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      },
    });
    (Billing.findById as jest.Mock).mockReturnValueOnce(chainable(billing));

    const req = buildReq({
      user: { userId: 'owner-001', userType: 'pet-owner', clinicId: '' },
      params: { id: 'billing-001' },
    });
    const res = buildRes();
    await downloadBillingPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
