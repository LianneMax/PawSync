import express from 'express';
import {
  createMedicalRecord,
  getRecordsByPet,
  getCurrentRecord,
  getHistoricalRecords,
  getVaccinationsByPet,
  getRecordById,
  getRecordByAppointment,
  getVetMedicalRecords,
  updateRecord,
  toggleShareRecord,
  getRecordImage
} from '../controllers/medicalRecordController';
import { authMiddleware, vetOrClinicAdminOnly } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/medical-records
 * Create a new medical record (vet or clinic-admin).
 */
router.post('/', authMiddleware, vetOrClinicAdminOnly, createMedicalRecord);

/**
 * GET /api/medical-records/vet/my-records
 * Get all records created by this vet (or all clinic records for clinic-admin).
 */
router.get('/vet/my-records', authMiddleware, vetOrClinicAdminOnly, getVetMedicalRecords);

/**
 * GET /api/medical-records/appointment/:appointmentId
 * Get the medical record linked to a specific appointment.
 */
router.get('/appointment/:appointmentId', authMiddleware, vetOrClinicAdminOnly, getRecordByAppointment);

/**
 * GET /api/medical-records/pet/:petId/vaccinations
 * Get all vaccinations for a pet
 */
router.get('/pet/:petId/vaccinations', authMiddleware, getVaccinationsByPet);

/**
 * GET /api/medical-records/pet/:petId/current
 * Get the current medical record for a pet
 */
router.get('/pet/:petId/current', authMiddleware, getCurrentRecord);

/**
 * GET /api/medical-records/pet/:petId/historical
 * Get all historical (non-current) medical records for a pet
 */
router.get('/pet/:petId/historical', authMiddleware, getHistoricalRecords);

/**
 * GET /api/medical-records/pet/:petId
 * Get all medical records for a pet (current + historical)
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
router.put('/:id', authMiddleware, vetOrClinicAdminOnly, updateRecord);

/**
 * PATCH /api/medical-records/:id/share
 * Toggle sharing a record with the pet owner
 */
router.patch('/:id/share', authMiddleware, vetOrClinicAdminOnly, toggleShareRecord);

/**
 * GET /api/medical-records/:id/images/:imageId
 * Get a specific image from a medical record
 */
router.get('/:id/images/:imageId', authMiddleware, getRecordImage);

export default router;
