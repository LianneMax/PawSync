import express from 'express';
import {
  getMyClinics,
  getAllClinics,
  getBranches,
  getMyBranches,
  addBranch,
  updateBranch,
  deleteBranch,
  assignVetToBranch,
  removeVetFromBranch,
  getClinicDashboardStats,
  getClinicVets,
  getClinicPatients,
  createClinicAdmin,
  getBranchStats,
  getSingleBranch,
  getRegisteredVets,
  inviteVet,
  acceptVetInvitation,
  sendBranchEmailOTP,
  verifyBranchEmailOTP,
  previewBranchClosure,
  applyBranchClosure,
  liftBranchClosure,
  fireVet,
  createPetOwnerProfile,
  resendPetOwnerInvite,
  getClinicPetOwners,
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
 * GET /api/clinics/mine/registered-vets
 * Get all registered (verified) veterinarians for the invite modal
 */
router.get('/mine/registered-vets', authMiddleware, clinicAdminOnly, getRegisteredVets);

/**
 * POST /api/clinics/mine/invite-vet
 * Send a branch invitation email to a registered vet
 */
router.post('/mine/invite-vet', authMiddleware, clinicAdminOnly, inviteVet);

/**
 * GET /api/clinics/invite/accept
 * Accept a vet invitation via token (public — no auth required)
 */
router.get('/invite/accept', acceptVetInvitation);

/**
 * GET /api/clinics/mine/patients
 * Get all patients for the authenticated clinic or branch admin (no clinicId param needed)
 */
router.get('/mine/patients', authMiddleware, clinicAdminOnly, getClinicPatients);

/**
 * GET /api/clinics/mine/branches
 * Get all active branches for the authenticated admin's clinic (resolves clinic from JWT)
 */
router.get('/mine/branches', authMiddleware, clinicAdminOnly, getMyBranches);

/**
 * POST /api/clinics/branch-otp/send
 * Send an OTP to the given branch email address for verification
 */
router.post('/branch-otp/send', authMiddleware, clinicAdminOnly, sendBranchEmailOTP);

/**
 * POST /api/clinics/branch-otp/verify
 * Verify the OTP entered by the user for the branch email
 */
router.post('/branch-otp/verify', authMiddleware, clinicAdminOnly, verifyBranchEmailOTP);

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
 * GET /api/clinics/:clinicId/branches/:branchId
 * Get a single branch (fresh from DB)
 */
router.get('/:clinicId/branches/:branchId', authMiddleware, clinicAdminOnly, getSingleBranch);

/**
 * GET /api/clinics/:clinicId/branches/:branchId/stats
 * Get statistics for a specific branch (vets, patients, appointments)
 */
router.get('/:clinicId/branches/:branchId/stats', authMiddleware, clinicAdminOnly, getBranchStats);

/**
 * POST /api/clinics/:clinicId/branches/:branchId/closure/preview
 * Preview affected appointments for a temporary branch closure.
 */
router.post('/:clinicId/branches/:branchId/closure/preview', authMiddleware, clinicAdminOnly, previewBranchClosure);

/**
 * POST /api/clinics/:clinicId/branches/:branchId/closure/apply
 * Apply temporary branch closure and cancel/reschedule affected appointments.
 */
router.post('/:clinicId/branches/:branchId/closure/apply', authMiddleware, clinicAdminOnly, applyBranchClosure);

/**
 * DELETE /api/clinics/:clinicId/branches/:branchId/closure
 * Remove today's closure to re-open the branch.
 */
router.delete('/:clinicId/branches/:branchId/closure', authMiddleware, clinicAdminOnly, liftBranchClosure);

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
 * POST /api/clinics/:clinicId/vets/:vetId/fire
 * Permanently terminate a vet: deactivate account, transfer records to replacement vet
 */
router.post('/:clinicId/vets/:vetId/fire', authMiddleware, clinicAdminOnly, mainBranchOnly, fireVet);

/**
 * GET /api/clinics/:clinicId/patients
 * Get all patients (pets) for a clinic
 */
router.get('/:clinicId/patients', authMiddleware, clinicAdminOnly, getClinicPatients);

/**
 * POST /api/clinics/clinic-admin
 * Create a new clinic admin account for a branch
 */
router.post('/clinic-admin', authMiddleware, clinicAdminOnly, mainBranchOnly, createClinicAdmin);

/**
 * GET /api/clinics/mine/pet-owners
 * List all clinic-created pet owner profiles with their onboarding status.
 */
router.get('/mine/pet-owners', authMiddleware, clinicAdminOnly, getClinicPetOwners);

/**
 * POST /api/clinics/mine/pet-owners
 * Create a pet owner profile on behalf of a client and send them an activation invite.
 * Body: { firstName, lastName, email, contactNumber }
 */
router.post('/mine/pet-owners', authMiddleware, clinicAdminOnly, createPetOwnerProfile);

/**
 * POST /api/clinics/mine/pet-owners/:ownerId/resend-invite
 * Resend the activation invite to a pet owner whose link has expired or was not received.
 * Invalidates the previous token. Subject to a 15-minute cooldown.
 */
router.post('/mine/pet-owners/:ownerId/resend-invite', authMiddleware, clinicAdminOnly, resendPetOwnerInvite);

export default router;
