import express from 'express';
import {
  getMyResignation,
  getBackupVetsForMyBranch,
  submitResignation,
  getClinicResignations,
  approveResignation,
  rejectResignation,
} from '../controllers/resignationController';
import { authMiddleware, veterinarianOnly, clinicAdminOnly } from '../middleware/auth';

const router = express.Router();

router.get('/mine', authMiddleware, veterinarianOnly, getMyResignation);
router.get('/backup-vets', authMiddleware, veterinarianOnly, getBackupVetsForMyBranch);
router.post('/submit', authMiddleware, veterinarianOnly, submitResignation);

router.get('/clinic', authMiddleware, clinicAdminOnly, getClinicResignations);
router.put('/:resignationId/approve', authMiddleware, clinicAdminOnly, approveResignation);
router.put('/:resignationId/reject', authMiddleware, clinicAdminOnly, rejectResignation);

export default router;
