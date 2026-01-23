import express from 'express';
import { register, login, getCurrentUser, logout } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 * Body: { firstName, lastName, email, password, confirmPassword, userType }
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Login user
 * Body: { email, password }
 */
router.post('/login', login);

/**
 * GET /api/auth/me
 * Get current user profile (requires authentication)
 * Header: Authorization: Bearer <token>
 */
router.get('/me', authMiddleware, getCurrentUser);

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', logout);

export default router;
