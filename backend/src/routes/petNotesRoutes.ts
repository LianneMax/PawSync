import express from 'express';
import { getPetNotes, upsertPetNotes } from '../controllers/petNotesController';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/pet-notes/:petId
 * Get vet notepad for a pet (vet or clinic-admin only).
 */
router.get('/:petId', authMiddleware, vetOrClinicAdminOnly, getPetNotes);

/**
 * PUT /api/pet-notes/:petId
 * Save/update vet notepad for a pet (vet or clinic-admin only).
 */
router.put('/:petId', authMiddleware, vetOrClinicAdminOnly, upsertPetNotes);

export default router;
