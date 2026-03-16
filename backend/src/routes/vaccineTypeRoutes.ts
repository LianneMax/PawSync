import express from 'express';
import {
  listVaccineTypes,
  createVaccineType,
  updateVaccineType,
  deleteVaccineType,
} from '../controllers/vaccineTypeController';
import { authMiddleware, clinicAdminOnly, vetOrClinicAdminOnly } from '../middleware/auth';

const router = express.Router();

// Public — no auth required (used by dropdowns in vet dashboard)
// GET /api/vaccine-types
router.get('/', listVaccineTypes);

// Vet or clinic admin / branch admin — create and update vaccine types
// POST /api/vaccine-types
router.post('/', authMiddleware, vetOrClinicAdminOnly, createVaccineType);

// PUT /api/vaccine-types/:id
router.put('/:id', authMiddleware, vetOrClinicAdminOnly, updateVaccineType);

// DELETE /api/vaccine-types/:id
router.delete('/:id', authMiddleware, vetOrClinicAdminOnly, deleteVaccineType);

export default router;
