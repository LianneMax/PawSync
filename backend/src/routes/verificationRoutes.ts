import express from 'express';
import {
  submitVerification,
  getClinicVerifications,
  approveVerification,
  rejectVerification,
  getMyVerification
} from '../controllers/verificationController';
import { authMiddleware, veterinarianOnly, clinicAdminOnly } from '../middleware/auth';

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
 * Get verification requests for admin's clinic (clinic admin)
 * Query: ?status=pending|verified|rejected
 */
router.get('/clinic', authMiddleware, clinicAdminOnly, getClinicVerifications);

/**
 * PUT /api/verifications/:verificationId/approve
 * Approve a PRC verification (clinic admin)
 */
router.put('/:verificationId/approve', authMiddleware, clinicAdminOnly, approveVerification);

/**
 * PUT /api/verifications/:verificationId/reject
 * Reject a PRC verification (clinic admin)
 */
router.put('/:verificationId/reject', authMiddleware, clinicAdminOnly, rejectVerification);

export default router;
