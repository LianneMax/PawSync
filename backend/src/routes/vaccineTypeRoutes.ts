import express from 'express';
import {
  listVaccineTypes,
  createVaccineType,
  updateVaccineType,
} from '../controllers/vaccineTypeController';
import { authMiddleware, clinicOrBranchAdminOnly } from '../middleware/auth';

const router = express.Router();

// Public — no auth required (used by dropdowns in vet dashboard)
// GET /api/vaccine-types
router.get('/', listVaccineTypes);

// Clinic admin / branch admin only
// POST /api/vaccine-types
router.post('/', authMiddleware, clinicOrBranchAdminOnly, createVaccineType);

// PUT /api/vaccine-types/:id
router.put('/:id', authMiddleware, clinicOrBranchAdminOnly, updateVaccineType);

export default router;
