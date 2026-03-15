import express from 'express';
import {
  createReport,
  listReports,
  getReport,
  getSharedReport,
  updateReport,
  shareReport,
  generateReport,
} from '../controllers/vetReportController';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';

const router = express.Router();

// Public: shared report (no auth — owner opens via link)
router.get('/shared/:id', getSharedReport);

// Vet / clinic-admin protected routes
router.get('/', authMiddleware, vetOrClinicAdminOnly, listReports);
router.post('/', authMiddleware, vetOrClinicAdminOnly, createReport);
router.get('/:id', authMiddleware, vetOrClinicAdminOnly, getReport);
router.put('/:id', authMiddleware, vetOrClinicAdminOnly, updateReport);
router.patch('/:id/share', authMiddleware, vetOrClinicAdminOnly, shareReport);
router.post('/:id/generate', authMiddleware, vetOrClinicAdminOnly, generateReport);

export default router;
