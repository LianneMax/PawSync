import type { Request, Response } from 'express';

// ─── Mock external dependencies ───────────────────────────────────────────────

jest.mock('../models/PaymentQR', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import PaymentQR from '../models/PaymentQR';

import {
  listPaymentQRs,
  createPaymentQR,
  updatePaymentQR,
  deletePaymentQR,
} from '../controllers/paymentQRController';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRes(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function buildReq(overrides: {
  user?: Record<string, string | null> | null;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
} = {}): Request {
  return {
    user: { userId: 'admin-111', userType: 'clinic-admin', clinicId: 'clinic-001' },
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function chainable(value: unknown) {
  const q: any = {
    sort: jest.fn().mockReturnThis(),
    then: (onfulfilled: any, onrejected?: any) =>
      Promise.resolve(value).then(onfulfilled, onrejected),
    catch: (onrejected: any) => Promise.resolve(value).catch(onrejected),
    finally: (onfinally: any) => Promise.resolve(value).finally(onfinally),
  };
  return q;
}

function buildQrDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'qr-001',
    label: 'GCash',
    imageData: 'data:image/png;base64,abc123',
    isActive: true,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── listPaymentQRs ───────────────────────────────────────────────────────────

describe('listPaymentQRs', () => {
  it('returns all active QR codes (View Current QRs)', async () => {
    const qrs = [
      buildQrDoc({ label: 'GCash' }),
      buildQrDoc({ _id: 'qr-002', label: 'Maya' }),
    ];
    (PaymentQR.find as jest.Mock).mockReturnValue(chainable(qrs));

    const req = buildReq();
    const res = buildRes();
    await listPaymentQRs(req, res);

    expect(PaymentQR.find).toHaveBeenCalledWith({ isActive: true });
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('SUCCESS');
    expect(body.data.items).toHaveLength(2);
  });

  it('returns empty array when no QR codes exist', async () => {
    (PaymentQR.find as jest.Mock).mockReturnValue(chainable([]));

    const req = buildReq();
    const res = buildRes();
    await listPaymentQRs(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.items).toHaveLength(0);
  });
});

// ─── createPaymentQR ──────────────────────────────────────────────────────────

describe('createPaymentQR', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await createPaymentQR(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when label is missing', async () => {
    const req = buildReq({ body: { imageData: 'data:image/png;base64,abc' } });
    const res = buildRes();
    await createPaymentQR(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Label is required' }),
    );
  });

  it('returns 400 when imageData is missing', async () => {
    const req = buildReq({ body: { label: 'GCash' } });
    const res = buildRes();
    await createPaymentQR(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Image data is required' }),
    );
  });

  it('uploads QR code and returns 201 (Upload QR Button)', async () => {
    const created = buildQrDoc();
    (PaymentQR.create as jest.Mock).mockResolvedValueOnce(created);

    const req = buildReq({
      body: { label: 'GCash', imageData: 'data:image/png;base64,iVBORw0KGgo=' },
    });
    const res = buildRes();
    await createPaymentQR(req, res);

    expect(PaymentQR.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'GCash', imageData: 'data:image/png;base64,iVBORw0KGgo=' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('SUCCESS');
    expect(body.message).toBe('QR code uploaded successfully');
  });
});

// ─── updatePaymentQR ──────────────────────────────────────────────────────────

describe('updatePaymentQR', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await updatePaymentQR(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when QR code not found or inactive', async () => {
    (PaymentQR.findById as jest.Mock).mockResolvedValueOnce(null);

    const req = buildReq({ params: { id: 'nonexistent' }, body: { label: 'Maya' } });
    const res = buildRes();
    await updatePaymentQR(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when label is set to empty string', async () => {
    const qr = buildQrDoc();
    (PaymentQR.findById as jest.Mock).mockResolvedValueOnce(qr);

    const req = buildReq({ params: { id: 'qr-001' }, body: { label: '   ' } });
    const res = buildRes();
    await updatePaymentQR(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Label cannot be empty' }),
    );
  });

  it('updates label and imageData and returns 200', async () => {
    const qr = buildQrDoc({ label: 'GCash' });
    (PaymentQR.findById as jest.Mock).mockResolvedValueOnce(qr);

    const req = buildReq({
      params: { id: 'qr-001' },
      body: { label: 'Maya', imageData: 'data:image/png;base64,newdata' },
    });
    const res = buildRes();
    await updatePaymentQR(req, res);

    expect(qr.label).toBe('Maya');
    expect(qr.imageData).toBe('data:image/png;base64,newdata');
    expect(qr.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── deletePaymentQR ──────────────────────────────────────────────────────────

describe('deletePaymentQR', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await deletePaymentQR(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when QR code not found', async () => {
    (PaymentQR.findById as jest.Mock).mockResolvedValueOnce(null);

    const req = buildReq({ params: { id: 'nonexistent' } });
    const res = buildRes();
    await deletePaymentQR(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('soft-deletes QR by setting isActive false and returns 200', async () => {
    const qr = buildQrDoc();
    (PaymentQR.findById as jest.Mock).mockResolvedValueOnce(qr);

    const req = buildReq({ params: { id: 'qr-001' } });
    const res = buildRes();
    await deletePaymentQR(req, res);

    expect(qr.isActive).toBe(false);
    expect(qr.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'QR code deleted successfully' }),
    );
  });
});
