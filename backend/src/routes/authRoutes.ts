import express from 'express';
import { register, login, getCurrentUser, logout, forgotPassword, verifyOtp, resetPassword, googleAuth } from '../controllers/authController';
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
 * POST /api/auth/forgot-password
 * Send OTP to email for password reset
 * Body: { email }
 */
router.post('/forgot-password', forgotPassword);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and get reset token
 * Body: { email, otp }
 */
router.post('/verify-otp', verifyOtp);

/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 * Body: { email, resetToken, newPassword, confirmPassword }
 */
router.post('/reset-password', resetPassword);

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', logout);

/**
 * POST /api/auth/google
 * Google OAuth authentication (login or register)
 * Body: { access_token: string, userType?: 'pet-owner' | 'veterinarian' }
 */
router.post('/google', googleAuth);

export default router;
