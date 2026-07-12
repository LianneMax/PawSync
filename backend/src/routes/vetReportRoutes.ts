import express from 'express';
import {
  createReport,
  listReports,
  getReport,
  getSharedReport,
  updateReport,
  shareReport,
  generateReport,
  humanizeReport,
  updateOwnerSummary,
  listSharedReportsForOwner,
  syncReportRecords,
  deleteReport,
  addReportAddendum,
} from '../controllers/vetReportController';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';

const router = express.Router();

// Public: shared report (no auth — owner opens via link)
router.get('/shared/:id', getSharedReport);

// Owner: list shared reports for a pet (requires auth, any user type)
router.get('/for-owner/pet/:petId', authMiddleware, listSharedReportsForOwner);

// Vet / clinic-admin protected routes
router.get('/', authMiddleware, vetOrClinicAdminOnly, listReports);
router.post('/', authMiddleware, vetOrClinicAdminOnly, createReport);
router.get('/:id', authMiddleware, vetOrClinicAdminOnly, getReport);
router.put('/:id', authMiddleware, vetOrClinicAdminOnly, updateReport);
router.delete('/:id', authMiddleware, vetOrClinicAdminOnly, deleteReport);
router.patch('/:id/share', authMiddleware, vetOrClinicAdminOnly, shareReport);
router.post('/:id/generate', authMiddleware, vetOrClinicAdminOnly, generateReport);
router.post('/:id/sync-records', authMiddleware, vetOrClinicAdminOnly, syncReportRecords);
router.post('/:id/humanize', authMiddleware, vetOrClinicAdminOnly, humanizeReport);
router.patch('/:id/owner-summary', authMiddleware, vetOrClinicAdminOnly, updateOwnerSummary);
router.post('/:id/addenda', authMiddleware, vetOrClinicAdminOnly, addReportAddendum);

export default router;
