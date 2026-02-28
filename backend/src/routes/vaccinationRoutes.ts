import express from 'express';
import {
  createVaccination,
  getVaccinationsByPet,
  getPublicVaccinationsByPet,
  getVaccinationById,
  updateVaccination,
  declineVaccination,
  getVetVaccinations,
  getClinicVaccinations,
  searchOwners,
  getPetsForOwner,
  verifyVaccinationByToken,
} from '../controllers/vaccinationController';
import {
  authMiddleware,
  veterinarianOnly,
  vetOrClinicAdminOnly,
  clinicOrBranchAdminOnly,
} from '../middleware/auth';

const router = express.Router();

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

// Decline vaccination (vet or clinic-admin)
// POST /api/vaccinations/:id/decline
router.post('/:id/decline', authMiddleware, vetOrClinicAdminOnly, declineVaccination);

export default router;
