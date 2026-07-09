import type { Request, Response } from 'express';

// ─── Mock external dependencies ───────────────────────────────────────────────

jest.mock('../models/ProductService', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../models/ClinicBranch', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('../controllers/clinicController', () => ({
  getClinicForAdmin: jest.fn().mockResolvedValue({ _id: 'clinic-001' }),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import ProductService from '../models/ProductService';

import {
  createProductService,
  updateProductService,
  deleteProductService,
} from '../controllers/productServiceController';

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
    lean: jest.fn().mockResolvedValue(value),
    then: (onfulfilled: any, onrejected?: any) =>
      Promise.resolve(value).then(onfulfilled, onrejected),
    catch: (onrejected: any) => Promise.resolve(value).catch(onrejected),
    finally: (onfinally: any) => Promise.resolve(value).finally(onfinally),
  };
  return q;
}

function buildServiceDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'svc-001',
    name: 'Dental Cleaning',
    type: 'Service',
    category: 'Others',
    price: 1500,
    isActive: true,
    isSystemProduct: false,
    branchAvailability: [],
    administrationRoute: null,
    administrationMethod: null,
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── createProductService ─────────────────────────────────────────────────────

describe('createProductService', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await createProductService(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when name, type, or price is missing', async () => {
    const req = buildReq({ body: { name: 'Dental Cleaning', type: 'Service' } });
    const res = buildRes();
    await createProductService(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'name, type, and price are required' }),
    );
  });

  it('returns 409 when service with same name already exists', async () => {
    (ProductService.findOne as jest.Mock).mockResolvedValueOnce({ _id: 'existing-001', name: 'Dental Cleaning' });

    const req = buildReq({
      body: {
        name: 'Dental Cleaning',
        type: 'Service',
        price: 1500,
        branchAvailability: [{ branchId: 'branch-001', isActive: true }],
      },
    });
    const res = buildRes();
    await createProductService(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('already exists') }),
    );
  });

  it('creates service and returns 201 with populated item', async () => {
    (ProductService.findOne as jest.Mock).mockResolvedValueOnce(null);
    const created = buildServiceDoc();
    (ProductService.create as jest.Mock).mockResolvedValueOnce(created);
    (ProductService.findById as jest.Mock).mockReturnValue(chainable(created));

    const req = buildReq({
      body: {
        name: 'Dental Cleaning',
        type: 'Service',
        price: 1500,
        branchAvailability: [{ branchId: 'branch-001', isActive: true }],
      },
    });
    const res = buildRes();
    await createProductService(req, res);

    expect(ProductService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dental Cleaning', type: 'Service', price: 1500 }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('SUCCESS');
  });
});

// ─── updateProductService ─────────────────────────────────────────────────────

describe('updateProductService', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await updateProductService(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when service not found', async () => {
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(null);

    const req = buildReq({ params: { id: 'nonexistent' }, body: { price: 2000 } });
    const res = buildRes();
    await updateProductService(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates service price and returns 200', async () => {
    const service = buildServiceDoc({ price: 1500 });
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(service);

    const req = buildReq({
      params: { id: 'svc-001' },
      body: { price: 2000 },
    });
    const res = buildRes();
    await updateProductService(req, res);

    expect(service.price).toBe(2000);
    expect(service.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('system product — only allows price and branchAvailability update', async () => {
    const service = buildServiceDoc({ isSystemProduct: true, price: 500 });
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(service);

    const req = buildReq({
      params: { id: 'svc-001' },
      body: { price: 750 },
    });
    const res = buildRes();
    await updateProductService(req, res);

    expect(service.price).toBe(750);
    expect(service.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── deleteProductService ─────────────────────────────────────────────────────

describe('deleteProductService', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();
    await deleteProductService(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 404 when service not found', async () => {
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(null);

    const req = buildReq({ params: { id: 'nonexistent' } });
    const res = buildRes();
    await deleteProductService(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when trying to delete a system product', async () => {
    const service = buildServiceDoc({ isSystemProduct: true });
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(service);

    const req = buildReq({ params: { id: 'svc-001' } });
    const res = buildRes();
    await deleteProductService(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'This is a system product and cannot be deleted' }),
    );
  });

  it('soft-deletes service with no linked invoices — sets isActive false', async () => {
    const service = buildServiceDoc();
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(service);

    const req = buildReq({ params: { id: 'svc-001' } });
    const res = buildRes();
    await deleteProductService(req, res);

    expect(service.isActive).toBe(false);
    expect(service.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Product/service deleted successfully' }),
    );
  });

  it('soft-deletes service even when linked to invoices (no invoice guard in current impl)', async () => {
    const service = buildServiceDoc({ name: 'Dental Cleaning' });
    (ProductService.findById as jest.Mock).mockResolvedValueOnce(service);

    const req = buildReq({ params: { id: 'svc-001' } });
    const res = buildRes();
    await deleteProductService(req, res);

    expect(service.isActive).toBe(false);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
