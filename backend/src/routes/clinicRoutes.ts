import express from 'express';
import {
  getMyClinics,
  getAllClinics,
  getBranches,
  addBranch,
  updateBranch,
  deleteBranch,
  assignVetToBranch,
  removeVetFromBranch,
  getClinicDashboardStats,
  getClinicVets,
  getClinicPatients,
  createBranchAdmin
} from '../controllers/clinicController';
import { authMiddleware, clinicAdminOnly, mainBranchOnly } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/clinics
 * Get all active clinics with branches (public - for onboarding)
 */
router.get('/', getAllClinics);

/**
 * GET /api/clinics/mine
 * Get clinics managed by the authenticated admin
 */
router.get('/mine', authMiddleware, clinicAdminOnly, getMyClinics);

/**
 * GET /api/clinics/mine/stats
 * Get dashboard stats for the clinic admin
 */
router.get('/mine/stats', authMiddleware, clinicAdminOnly, getClinicDashboardStats);

/**
 * GET /api/clinics/mine/vets
 * Get approved vets for the clinic
 */
router.get('/mine/vets', authMiddleware, clinicAdminOnly, getClinicVets);

/**
 * GET /api/clinics/:clinicId/branches
 * Get all branches for a clinic (admin only)
 */
router.get('/:clinicId/branches', authMiddleware, clinicAdminOnly, getBranches);

/**
 * POST /api/clinics/:clinicId/branches
 * Add a branch to a clinic
 */
router.post('/:clinicId/branches', authMiddleware, clinicAdminOnly, mainBranchOnly, addBranch);

/**
 * PUT /api/clinics/:clinicId/branches/:branchId
 * Update a branch
 */
router.put('/:clinicId/branches/:branchId', authMiddleware, clinicAdminOnly, updateBranch);

/**
 * DELETE /api/clinics/:clinicId/branches/:branchId
 * Delete a branch
 */
router.delete('/:clinicId/branches/:branchId', authMiddleware, clinicAdminOnly, mainBranchOnly, deleteBranch);

/**
 * POST /api/clinics/:clinicId/vets
 * Assign a vet to a clinic branch
 */
router.post('/:clinicId/vets', authMiddleware, clinicAdminOnly, assignVetToBranch);

/**
 * DELETE /api/clinics/:clinicId/vets/:assignmentId
 * Remove a vet from a clinic branch
 */
router.delete('/:clinicId/vets/:assignmentId', authMiddleware, clinicAdminOnly, removeVetFromBranch);

/**
 * GET /api/clinics/:clinicId/patients
 * Get all patients (pets) for a clinic
 */
router.get('/:clinicId/patients', authMiddleware, clinicAdminOnly, getClinicPatients);

/**
 * POST /api/clinics/branch-admin
 * Create a new branch admin account
 */
router.post('/branch-admin', authMiddleware, clinicAdminOnly, mainBranchOnly, createBranchAdmin);

export default router;
