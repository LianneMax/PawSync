import express from 'express';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';
import { createReferral } from '../controllers/referralController';

const router = express.Router();

/**
 * POST /api/referrals
 * Create a care-plan referral (shares pet medical history with the referred vet)
 */
router.post('/', authMiddleware, vetOrClinicAdminOnly, createReferral);

export default router;
