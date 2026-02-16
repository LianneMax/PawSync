import express from 'express';
import {
  applyToClinic,
  getClinicApplications,
  approveApplication,
  rejectApplication,
  getMyApplications
} from '../controllers/vetApplicationController';
import { authMiddleware, veterinarianOnly, clinicAdminOnly } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/vet-applications
 * Submit an application to a clinic (vet)
 */
router.post('/', authMiddleware, veterinarianOnly, applyToClinic);

/**
 * GET /api/vet-applications/mine
 * Get my applications (vet)
 */
router.get('/mine', authMiddleware, veterinarianOnly, getMyApplications);

/**
 * GET /api/vet-applications/clinic
 * Get applications for admin's clinic (clinic admin)
 * Query: ?status=pending|approved|rejected
 */
router.get('/clinic', authMiddleware, clinicAdminOnly, getClinicApplications);

/**
 * PUT /api/vet-applications/:applicationId/approve
 * Approve a vet application (clinic admin)
 */
router.put('/:applicationId/approve', authMiddleware, clinicAdminOnly, approveApplication);

/**
 * PUT /api/vet-applications/:applicationId/reject
 * Reject a vet application (clinic admin)
 */
router.put('/:applicationId/reject', authMiddleware, clinicAdminOnly, rejectApplication);

export default router;
