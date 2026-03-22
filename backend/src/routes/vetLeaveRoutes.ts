import express from 'express';
import { previewLeave, applyLeave, getMyLeaves, cancelLeave } from '../controllers/vetLeaveController';
import { authMiddleware, veterinarianOnly } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/vet-leave/preview
 * Check what would happen if leave is filed on a given date (no side effects).
 */
router.post('/preview', authMiddleware, veterinarianOnly, previewLeave);

/**
 * POST /api/vet-leave
 * File a leave with optional reassignment/cancellation decisions.
 */
router.post('/', authMiddleware, veterinarianOnly, applyLeave);

/**
 * GET /api/vet-leave/mine
 * Get the authenticated vet's active upcoming leaves.
 */
router.get('/mine', authMiddleware, veterinarianOnly, getMyLeaves);

/**
 * DELETE /api/vet-leave/:id
 * Cancel a filed leave (only future leaves).
 */
router.delete('/:id', authMiddleware, veterinarianOnly, cancelLeave);

export default router;
