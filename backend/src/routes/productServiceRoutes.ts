import express from 'express';
import {
  listProductServices,
  createProductService,
  updateProductService,
  deleteProductService,
  migrateBranchAvailability,
  updateBranchAvailability,
} from '../controllers/productServiceController';
import { authMiddleware, clinicAdminOnly, mainBranchOnly } from '../middleware/auth';

const router = express.Router();

// All authenticated clinic staff — search catalog
// GET /api/product-services
router.get('/', authMiddleware, listProductServices);

// Main branch clinic admin only — add/edit/delete catalog items
// POST /api/product-services
router.post('/', authMiddleware, clinicAdminOnly, mainBranchOnly, createProductService);

// PUT /api/product-services/:id
router.put('/:id', authMiddleware, clinicAdminOnly, mainBranchOnly, updateProductService);

// DELETE /api/product-services/:id
router.delete('/:id', authMiddleware, clinicAdminOnly, mainBranchOnly, deleteProductService);

// PATCH /api/product-services/:id/branch-availability
// Any clinic admin — toggle their own branch's availability for an item
router.patch('/:id/branch-availability', authMiddleware, clinicAdminOnly, updateBranchAvailability);

// POST /api/product-services/migrate-branches
// One-time idempotent migration: assigns all active branches to qualifying items with no branch availability
router.post('/migrate-branches', authMiddleware, clinicAdminOnly, mainBranchOnly, migrateBranchAvailability);

export default router;
