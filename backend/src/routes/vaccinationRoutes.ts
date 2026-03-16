import express from 'express';
import {
  createVaccination,
  getVaccinationsByPet,
  getVaccinationsByMedicalRecord,
  getPublicVaccinationsByPet,
  getVaccinationById,
  updateVaccination,
  deleteVaccination,
  declineVaccination,
  getVetVaccinations,
  getClinicVaccinations,
  searchOwners,
  getPetsForOwner,
  verifyVaccinationByToken,
  getUpcomingVaccineDates,
  getVetUpcomingVaccineSchedule,
  getClinicUpcomingVaccineSchedule,
} from '../controllers/vaccinationController';
import {
  authMiddleware,
  veterinarianOnly,
  vetOrClinicAdminOnly,
  clinicOrBranchAdminOnly,
} from '../middleware/auth';

const router = express.Router();

// Upcoming vaccine schedules
// GET /api/vaccinations/pet/:petId/upcoming
router.get('/pet/:petId/upcoming', authMiddleware, getUpcomingVaccineDates);

// Vet's upcoming vaccine schedule
// GET /api/vaccinations/vet/:vetId/upcoming-schedule
router.get('/vet/:vetId/upcoming-schedule', authMiddleware, getVetUpcomingVaccineSchedule);

// Clinic's upcoming vaccine schedule
// GET /api/vaccinations/clinic/:clinicId/upcoming-schedule
router.get('/clinic/:clinicId/upcoming-schedule', authMiddleware, clinicOrBranchAdminOnly, getClinicUpcomingVaccineSchedule);

// Vet's own vaccination records (list view / filter)
// GET /api/vaccinations/vet/my-records
router.get('/vet/my-records', authMiddleware, veterinarianOnly, getVetVaccinations);

// Clinic admin — all vaccinations for their clinic/branch
// GET /api/vaccinations/clinic/records
router.get('/clinic/records', authMiddleware, clinicOrBranchAdminOnly, getClinicVaccinations);

// Patient search (for vet / clinic-admin form)
// GET /api/vaccinations/search/owners?q=
router.get('/search/owners', authMiddleware, vetOrClinicAdminOnly, searchOwners);
// GET /api/vaccinations/search/pets?ownerId=
router.get('/search/pets', authMiddleware, vetOrClinicAdminOnly, getPetsForOwner);

// Public — no auth — for NFC profile page
// GET /api/vaccinations/pet/:petId/public
router.get('/pet/:petId/public', getPublicVaccinationsByPet);

// Authenticated pet vaccinations
// GET /api/vaccinations/pet/:petId
router.get('/pet/:petId', authMiddleware, getVaccinationsByPet);

// Vaccinations linked to a specific medical record
// GET /api/vaccinations/medical-record/:medicalRecordId
router.get('/medical-record/:medicalRecordId', authMiddleware, getVaccinationsByMedicalRecord);

// Public verification by token (for QR codes)
// GET /api/vaccinations/verify/:token
router.get('/verify/:token', verifyVaccinationByToken);

// Single record
// GET /api/vaccinations/:id
router.get('/:id', authMiddleware, getVaccinationById);

// Create vaccination (vet or clinic-admin)
// POST /api/vaccinations
router.post('/', authMiddleware, vetOrClinicAdminOnly, createVaccination);

// Update vaccination (vet or clinic-admin)
// PUT /api/vaccinations/:id
router.put('/:id', authMiddleware, vetOrClinicAdminOnly, updateVaccination);

// Delete vaccination (vet or clinic-admin)
// DELETE /api/vaccinations/:id
router.delete('/:id', authMiddleware, vetOrClinicAdminOnly, deleteVaccination);

// Decline vaccination (vet or clinic-admin)
// POST /api/vaccinations/:id/decline
router.post('/:id/decline', authMiddleware, vetOrClinicAdminOnly, declineVaccination);

export default router;
