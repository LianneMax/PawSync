import express from 'express';
import {
  createAppointment,
  getAvailableSlots,
  getGroomingSlots,
  getMyAppointments,
  getVetAppointments,
  cancelAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  getVetsForBranch,
  searchPetOwners,
  getPetsForOwner,
  createClinicAppointment,
  getClinicAppointments,
  getNextAppointment,
  getAppointmentById,
  getClinicBranches,
  getVetsByBranchId,
} from '../controllers/appointmentController';
import { authMiddleware, veterinarianOnly, petOwnerOnly, clinicAdminOnly, clinicOrBranchAdminOnly } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/appointments
 * Book a new appointment
 */
router.post('/', authMiddleware, createAppointment);

/**
 * GET /api/appointments/slots?vetId=...&date=...
 * Get available time slots for a vet on a date
 */
router.get('/slots', authMiddleware, getAvailableSlots);

/**
 * GET /api/appointments/grooming-slots?branchId=...&date=...
 * Get available time slots for grooming based on clinic branch hours
 */
router.get('/grooming-slots', authMiddleware, getGroomingSlots);

/**
 * GET /api/appointments/clinic-branches
 * Get all clinic branches for the authenticated user's clinic
 */
router.get('/clinic-branches', authMiddleware, getClinicBranches);

/**
 * GET /api/appointments/clinic-branches/:branchId/vets
 * Get approved vets for a specific clinic branch
 */
router.get('/clinic-branches/:branchId/vets', authMiddleware, getVetsByBranchId);

/**
 * GET /api/appointments/branch-vets?branchId=...
 * Get approved vets for a specific clinic branch
 */
router.get('/branch-vets', authMiddleware, getVetsForBranch);

/**
 * GET /api/appointments/mine?filter=upcoming|previous
 * Get authenticated user's appointments
 */
router.get('/mine', authMiddleware, getMyAppointments);

/**
 * GET /api/appointments/pet/:petId/next
 * Get the next upcoming appointment for a pet
 */
router.get('/pet/:petId/next', authMiddleware, getNextAppointment);

/**
 * GET /api/appointments/vet
 * Get appointments for the authenticated vet
 */
router.get('/vet', authMiddleware, getVetAppointments);

// ==================== CLINIC ADMIN ROUTES ====================
// These must be registered before /:id to prevent "clinic" being matched as an ObjectId

/**
 * GET /api/appointments/clinic/search-owners?q=...
 * Search pet owners by name (clinic admin)
 */
router.get('/clinic/search-owners', authMiddleware, clinicOrBranchAdminOnly, searchPetOwners);

/**
 * GET /api/appointments/clinic/owner-pets?ownerId=...
 * Get pets for a specific owner (clinic admin)
 */
router.get('/clinic/owner-pets', authMiddleware, clinicOrBranchAdminOnly, getPetsForOwner);

/**
 * POST /api/appointments/clinic
 * Create appointment on behalf of a pet owner (clinic admin)
 */
router.post('/clinic', authMiddleware, clinicOrBranchAdminOnly, createClinicAppointment);

/**
 * GET /api/appointments/clinic?date=...&branchId=...&filter=upcoming|previous
 * Get all appointments for the clinic (clinic admin)
 */
router.get('/clinic', authMiddleware, clinicOrBranchAdminOnly, getClinicAppointments);

/**
 * GET /api/appointments/:id
 * Get a single appointment by ID (vet, owner, clinic admin)
 */
router.get('/:id', authMiddleware, getAppointmentById);

/**
 * PATCH /api/appointments/:id/cancel
 * Cancel an appointment
 */
router.patch('/:id/cancel', authMiddleware, cancelAppointment);

/**
 * PATCH /api/appointments/:id/status
 * Update appointment status (confirm/complete)
 */
router.patch('/:id/status', authMiddleware, updateAppointmentStatus);

/**
 * PATCH /api/appointments/:id/reschedule
 * Reschedule an appointment to a new date/time (clinic admin)
 */
router.patch('/:id/reschedule', authMiddleware, clinicOrBranchAdminOnly, rescheduleAppointment);

export default router;
