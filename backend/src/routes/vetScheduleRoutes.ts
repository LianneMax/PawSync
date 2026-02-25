import express from 'express';
import { getMySchedule, upsertSchedule } from '../controllers/vetScheduleController';
import { authMiddleware, veterinarianOnly } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/vet-schedule/mine
 * Get vet's schedules for all approved branches
 */
router.get('/mine', authMiddleware, veterinarianOnly, getMySchedule);

/**
 * PUT /api/vet-schedule/:branchId
 * Create or update vet's schedule for a specific branch
 */
router.put('/:branchId', authMiddleware, veterinarianOnly, upsertSchedule);

export default router;
