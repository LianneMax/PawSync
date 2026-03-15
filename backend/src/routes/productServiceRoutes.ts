import express from 'express';
import {
  listProductServices,
  createProductService,
  updateProductService,
  deleteProductService,
  migrateBranchAvailability,
} from '../controllers/productServiceController';
import { authMiddleware, clinicOrBranchAdminOnly } from '../middleware/auth';

const router = express.Router();

// All authenticated clinic staff — search catalog
// GET /api/product-services
router.get('/', authMiddleware, listProductServices);

// Clinic admin / branch admin only
// POST /api/product-services
router.post('/', authMiddleware, clinicOrBranchAdminOnly, createProductService);

// PUT /api/product-services/:id
router.put('/:id', authMiddleware, clinicOrBranchAdminOnly, updateProductService);

// DELETE /api/product-services/:id
router.delete('/:id', authMiddleware, clinicOrBranchAdminOnly, deleteProductService);

// POST /api/product-services/migrate-branches
// One-time idempotent migration: assigns all active branches to qualifying items with no branch availability
router.post('/migrate-branches', authMiddleware, clinicOrBranchAdminOnly, migrateBranchAvailability);

export default router;
