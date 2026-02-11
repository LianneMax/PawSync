import express from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/users/profile
 * Get user profile
 */
router.get('/profile', authMiddleware, getProfile);

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', authMiddleware, updateProfile);

/**
 * PUT /api/users/change-password
 * Change password while logged in
 */
router.put('/change-password', authMiddleware, changePassword);

export default router;
