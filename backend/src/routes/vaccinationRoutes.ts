import express from 'express';
import {
  createVaccination,
  getVaccinationsByPet,
  getPublicVaccinationsByPet,
  getVaccinationById,
  updateVaccination,
  declineVaccination,
  getVetVaccinations,
  searchOwners,
  getPetsForOwner,
} from '../controllers/vaccinationController';
import { authMiddleware, veterinarianOnly } from '../middleware/auth';

const router = express.Router();

// Vet's own vaccination records (list view / filter)
// GET /api/vaccinations/vet/my-records
router.get('/vet/my-records', authMiddleware, veterinarianOnly, getVetVaccinations);

// Patient search (for vet form)
// GET /api/vaccinations/search/owners?q=
router.get('/search/owners', authMiddleware, searchOwners);
// GET /api/vaccinations/search/pets?ownerId=
router.get('/search/pets', authMiddleware, getPetsForOwner);

// Public — no auth — for NFC profile page
// GET /api/vaccinations/pet/:petId/public
router.get('/pet/:petId/public', getPublicVaccinationsByPet);

// Authenticated pet vaccinations
// GET /api/vaccinations/pet/:petId
router.get('/pet/:petId', authMiddleware, getVaccinationsByPet);

// Single record
// GET /api/vaccinations/:id
router.get('/:id', authMiddleware, getVaccinationById);

// Create vaccination (vet only)
// POST /api/vaccinations
router.post('/', authMiddleware, veterinarianOnly, createVaccination);

// Update vaccination (vet only)
// PUT /api/vaccinations/:id
router.put('/:id', authMiddleware, veterinarianOnly, updateVaccination);

// Decline vaccination (vet only)
// POST /api/vaccinations/:id/decline
router.post('/:id/decline', authMiddleware, veterinarianOnly, declineVaccination);

export default router;
