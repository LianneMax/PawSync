import express from 'express';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';
import { createReferral, getReferredPets } from '../controllers/referralController';

const router = express.Router();

/**
 * POST /api/referrals
 * Create a care-plan referral (shares pet medical history with the referred vet)
 */
router.post('/', authMiddleware, vetOrClinicAdminOnly, createReferral);

/**
 * GET /api/referrals/referred-pets
 * Returns all pets referred to the authenticated vet, for use in patient-records.
 */
router.get('/referred-pets', authMiddleware, getReferredPets);

export default router;
