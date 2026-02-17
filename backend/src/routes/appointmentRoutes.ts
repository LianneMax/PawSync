import express from 'express';
import {
  createAppointment,
  getAvailableSlots,
  getMyAppointments,
  getVetAppointments,
  cancelAppointment,
  updateAppointmentStatus,
  getVetsForBranch
} from '../controllers/appointmentController';
import { authMiddleware } from '../middleware/auth';

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

export default router;
