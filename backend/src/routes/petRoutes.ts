import express from 'express';
import { createPet, getMyPets, getPetById, updatePet, deletePet, transferPet, getPetByNfc, getPublicPetProfile, reportPetMissing, updatePetConfinement, scanPetAlert, reportPetFound } from '../controllers/petController';
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
 * GET /api/pets/:id/public
 * Get public pet profile (no auth - for QR/NFC scanning)
 */
router.get('/:id/public', getPublicPetProfile);

/**
 * POST /api/pets/:id/report-missing
 * Report a pet as missing (public - for scanners)
 */
router.post('/:id/report-missing', reportPetMissing);

/**
 * POST /api/pets/:id/scan-alert
 * Notify the owner when someone views a lost pet's public profile (public - no auth)
 */
router.post('/:id/scan-alert', scanPetAlert);

/**
 * POST /api/pets/:id/report-found
 * Save last scanned location when a finder shares their coordinates (public - no auth)
 */
router.post('/:id/report-found', reportPetFound);

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
 * PATCH /api/pets/:id/confined
 * Update confinement status — accessible by owner or treating vet
 */
router.patch('/:id/confined', authMiddleware, updatePetConfinement);

/**
 * POST /api/pets/:id/transfer
 * Transfer pet ownership to another pet-owner
 */
router.post('/:id/transfer', authMiddleware, transferPet);

/**
 * DELETE /api/pets/:id
 * Delete a pet
 */
router.delete('/:id', authMiddleware, deletePet);

export default router;
