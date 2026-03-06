import express from 'express';
import {
  listProductServices,
  createProductService,
  updateProductService,
  deleteProductService,
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

export default router;
