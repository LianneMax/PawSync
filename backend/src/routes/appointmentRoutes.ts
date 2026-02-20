import express from 'express';
import {
  createAppointment,
  getAvailableSlots,
  getMyAppointments,
  getVetAppointments,
  cancelAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  getVetsForBranch,
  searchPetOwners,
  getPetsForOwner,
  createClinicAppointment,
  getClinicAppointments
} from '../controllers/appointmentController';
import { authMiddleware, veterinarianOnly, petOwnerOnly, clinicAdminOnly } from '../middleware/auth';

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
 * GET /api/appointments/vet
 * Get appointments for the authenticated vet
 */
router.get('/vet', authMiddleware, getVetAppointments);

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
router.patch('/:id/reschedule', authMiddleware, clinicAdminOnly, rescheduleAppointment);

// ==================== CLINIC ADMIN ROUTES ====================

/**
 * GET /api/appointments/clinic/search-owners?q=...
 * Search pet owners by name (clinic admin)
 */
router.get('/clinic/search-owners', authMiddleware, clinicAdminOnly, searchPetOwners);

/**
 * GET /api/appointments/clinic/owner-pets?ownerId=...
 * Get pets for a specific owner (clinic admin)
 */
router.get('/clinic/owner-pets', authMiddleware, clinicAdminOnly, getPetsForOwner);

/**
 * POST /api/appointments/clinic
 * Create appointment on behalf of a pet owner (clinic admin)
 */
router.post('/clinic', authMiddleware, clinicAdminOnly, createClinicAppointment);

/**
 * GET /api/appointments/clinic?date=...&branchId=...&filter=upcoming|previous
 * Get all appointments for the clinic (clinic admin)
 */
router.get('/clinic', authMiddleware, clinicAdminOnly, getClinicAppointments);

export default router;
