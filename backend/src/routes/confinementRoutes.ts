import express from 'express';
import {
  listConfinementRecords,
  createConfinementRecord,
  updateConfinementRecord,
  getConfinementByPet,
  requestConfinementRelease,
  confirmConfinementRelease,
} from '../controllers/confinementController';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';

const router = express.Router();

// List all confinement records (vet or clinic-admin)
router.get('/', authMiddleware, vetOrClinicAdminOnly, listConfinementRecords);

// Get confinement history for a pet
router.get('/pet/:petId', authMiddleware, vetOrClinicAdminOnly, getConfinementByPet);

// Pet owner requests release from confinement
router.post('/pet/:petId/request-release', authMiddleware, requestConfinementRelease);

// Create confinement record
router.post('/', authMiddleware, vetOrClinicAdminOnly, createConfinementRecord);

// Update confinement record (discharge, add notes)
router.put('/:id', authMiddleware, vetOrClinicAdminOnly, updateConfinementRecord);

// Handling vet confirms release and discharges confinement
router.patch('/:id/confirm-release', authMiddleware, confirmConfinementRelease);

export default router;
