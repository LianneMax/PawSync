import express from 'express';
import {
  createMedicalRecord,
  getRecordsByPet,
  getVaccinationsByPet,
  getRecordById,
  updateRecord,
  deleteRecord,
  toggleShareRecord,
  getRecordImage
} from '../controllers/medicalRecordController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/medical-records
 * Create a new medical record
 */
router.post('/', authMiddleware, createMedicalRecord);

/**
 * GET /api/medical-records/pet/:petId/vaccinations
 * Get all vaccinations for a pet
 */
router.get('/pet/:petId/vaccinations', authMiddleware, getVaccinationsByPet);

/**
 * GET /api/medical-records/pet/:petId
 * Get all medical records for a pet
 */
router.get('/pet/:petId', authMiddleware, getRecordsByPet);

/**
 * GET /api/medical-records/:id
 * Get a single medical record (full report)
 */
router.get('/:id', authMiddleware, getRecordById);

/**
 * PUT /api/medical-records/:id
 * Update a medical record
 */
router.put('/:id', authMiddleware, updateRecord);

/**
 * DELETE /api/medical-records/:id
 * Delete a medical record
 */
router.delete('/:id', authMiddleware, deleteRecord);

/**
 * PATCH /api/medical-records/:id/share
 * Toggle sharing a record with the pet owner
 */
router.patch('/:id/share', authMiddleware, toggleShareRecord);

/**
 * GET /api/medical-records/:id/images/:imageId
 * Get a specific image from a medical record
 */
router.get('/:id/images/:imageId', authMiddleware, getRecordImage);

export default router;
