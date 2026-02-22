import express from 'express';
import {
  submitVerification,
  getClinicVerifications,
  approveVerification,
  rejectVerification,
  getMyVerification
} from '../controllers/verificationController';
import { authMiddleware, veterinarianOnly, clinicAdminOnly, clinicOrBranchAdminOnly } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/verifications
 * Submit a PRC verification request (vet)
 */
router.post('/', authMiddleware, veterinarianOnly, submitVerification);

/**
 * GET /api/verifications/mine
 * Get my verification status (vet)
 */
router.get('/mine', authMiddleware, veterinarianOnly, getMyVerification);

/**
 * GET /api/verifications/clinic
 * Get verification requests for admin's clinic or branch (clinic admin or branch admin)
 * Query: ?status=pending|verified|rejected
 */
router.get('/clinic', authMiddleware, clinicOrBranchAdminOnly, getClinicVerifications);

/**
 * PUT /api/verifications/:verificationId/approve
 * Approve a PRC verification (clinic admin or branch admin)
 */
router.put('/:verificationId/approve', authMiddleware, clinicOrBranchAdminOnly, approveVerification);

/**
 * PUT /api/verifications/:verificationId/reject
 * Reject a PRC verification (clinic admin or branch admin)
 */
router.put('/:verificationId/reject', authMiddleware, clinicOrBranchAdminOnly, rejectVerification);

export default router;
