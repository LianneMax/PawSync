import express from 'express';
import { createPet, getMyPets, getPetById, updatePet, deletePet, getPetByNfc } from '../controllers/petController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/pets
 * Get all pets for the authenticated user
 */
router.get('/', authMiddleware, getMyPets);

/**
 * POST /api/pets
 * Create a new pet
 */
router.post('/', authMiddleware, createPet);

/**
 * GET /api/pets/nfc/:nfcTagId
 * Get pet by NFC tag (public endpoint for scanning)
 */
router.get('/nfc/:nfcTagId', getPetByNfc);

/**
 * GET /api/pets/:id
 * Get a single pet by ID
 */
router.get('/:id', authMiddleware, getPetById);

/**
 * PUT /api/pets/:id
 * Update a pet
 */
router.put('/:id', authMiddleware, updatePet);

/**
 * DELETE /api/pets/:id
 * Delete a pet
 */
router.delete('/:id', authMiddleware, deletePet);

export default router;
