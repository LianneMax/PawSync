import express from 'express';
import {
  listProductServices,
  createProductService,
  updateProductService,
  deleteProductService,
  migrateBranchAvailability,
} from '../controllers/productServiceController';
import { authMiddleware, clinicAdminOnly } from '../middleware/auth';

const router = express.Router();

// All authenticated clinic staff — search catalog
// GET /api/product-services
router.get('/', authMiddleware, listProductServices);

// Clinic admin / branch admin only
// POST /api/product-services
router.post('/', authMiddleware, clinicAdminOnly, createProductService);

// PUT /api/product-services/:id
router.put('/:id', authMiddleware, clinicAdminOnly, updateProductService);

// DELETE /api/product-services/:id
router.delete('/:id', authMiddleware, clinicAdminOnly, deleteProductService);

// POST /api/product-services/migrate-branches
// One-time idempotent migration: assigns all active branches to qualifying items with no branch availability
router.post('/migrate-branches', authMiddleware, clinicAdminOnly, migrateBranchAvailability);

export default router;
