import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User, { IUser } from '../models/User';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import { Resend } from 'resend';

const getJwtSecret = () => process.env.JWT_SECRET || 'your-secret-key';
const getJwtExpire = () => process.env.JWT_EXPIRE || '7d';
const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes

let resendClient: Resend | null = null;
const getResend = (): Resend => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 'your_resend_key') {
      throw new Error('RESEND_API_KEY is not configured. Please set a valid API key in your .env file.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

/**
 * Generate JWT token
 */
const generateToken = (user: IUser, isMainBranch?: boolean): string => {
  const payload: any = {
    userId: user._id,
    email: user.email,
    userType: user.userType
  };

  // Include clinic and branch info for clinic-admin users
  if (user.userType === 'clinic-admin') {
    if (user.clinicId) {
      payload.clinicId = user.clinicId;
      payload.clinicBranchId = user.clinicBranchId;
    }
    payload.isMainBranch = !!isMainBranch;
  }

  // Include clinic and branch info for branch-admin users
  if (user.userType === 'branch-admin' && user.clinicId && user.branchId) {
    payload.clinicId = user.clinicId;
    payload.branchId = user.branchId;
    payload.isMainBranch = !!isMainBranch;
  }

  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpire() } as any);
};

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, confirmPassword, userType, mobileNumber } = req.body;
    let { firstName, lastName } = req.body;

    // Validation
    if (!email || !password || !confirmPassword || !userType) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide all required fields'
      });
    }

    // Validate first name and last name
    if (!firstName || !lastName) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide first name and last name'
      });
    }

    // Validate mobile number
    if (!mobileNumber) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide a mobile number'
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Passwords do not match'
      });
    }

    // Check password strength
    if (password.length < 6) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Email is already registered'
      });
    }

    // Validate user type
    if (!['pet-owner', 'veterinarian'].includes(userType)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid user type. Must be "pet-owner" or "veterinarian"'
      });
    }

    // Create new user
    const newUser = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      contactNumber: mobileNumber || null,
      password,
      userType,
      isVerified: userType !== 'veterinarian' // Pet owners are auto-verified
    });

    // Generate token
    const token = generateToken(newUser);

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          userType: newUser.userType,
          isVerified: newUser.isVerified
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred during registration'
    });
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide email and password'
      });
    }

    // Find user by email (need to select password field)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        status: 'ERROR',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      const remainingMs = (user.lockUntil as Date).getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        status: 'ERROR',
        code: 'ACCOUNT_LOCKED',
        message: `Account is locked. Please try again in ${remainingMinutes} minutes.`,
        lockUntil: user.lockUntil
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION);
        user.loginAttempts = 0;
        await user.save({ validateBeforeSave: false });

        return res.status(423).json({
          status: 'ERROR',
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed attempts. Account locked for 15 minutes.',
          lockUntil: user.lockUntil
        });
      }

      await user.save({ validateBeforeSave: false });

      return res.status(401).json({
        status: 'ERROR',
        code: 'INCORRECT_PASSWORD',
        message: 'Your password is incorrect, please try again.',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - user.loginAttempts
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save({ validateBeforeSave: false });
    }

    // Check if this clinic-admin or branch-admin is on the main branch
    let isMainBranch = false;
    if (user.userType === 'clinic-admin' && user.clinicBranchId) {
      const branch = await ClinicBranch.findById(user.clinicBranchId).select('isMain');
      isMainBranch = !!branch?.isMain;
    } else if (user.userType === 'clinic-admin' && user.clinicId && !user.clinicBranchId) {
      // Legacy admin without clinicBranchId — treat as main
      isMainBranch = true;
    } else if (user.userType === 'clinic-admin' && !user.clinicId && !user.clinicBranchId) {
      // Clinic admin with no clinic/branch link — treat as main branch admin
      isMainBranch = true;
    } else if (user.userType === 'branch-admin' && user.branchId) {
      // For branch admins, get isMainBranch from the branch
      const branch = await ClinicBranch.findById(user.branchId).select('isMain');
      isMainBranch = !!branch?.isMain;
    }

    // Generate token
    const token = generateToken(user, isMainBranch);

    // Build user response
    const userData: any = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      userType: user.userType,
      isVerified: user.isVerified
    };

    // Include clinic/branch info for clinic-admin users
    if (user.userType === 'clinic-admin') {
      if (user.clinicId) {
        userData.clinicId = user.clinicId;
        userData.clinicBranchId = user.clinicBranchId;
      }
      userData.isMainBranch = isMainBranch;
    }

    // Include clinic/branch info for branch-admin users
    if (user.userType === 'branch-admin' && user.clinicId && user.branchId) {
      userData.clinicId = user.clinicId;
      userData.branchId = user.branchId;
      userData.isMainBranch = isMainBranch;
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Login successful',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred during login'
    });
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User not found'
      });
    }

    const userData: any = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      userType: user.userType,
      isVerified: user.isVerified
    };

    if (user.userType === 'clinic-admin' && user.clinicId) {
      userData.clinicId = user.clinicId;
      userData.clinicBranchId = user.clinicBranchId;
      // Check if main branch
      if (user.clinicBranchId) {
        const branch = await ClinicBranch.findById(user.clinicBranchId).select('isMain');
        userData.isMainBranch = !!branch?.isMain;
      } else {
        userData.isMainBranch = true; // Legacy admin without branch
      }
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: { user: userData }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred while fetching user profile'
    });
  }
};

/**
 * Forgot password - send OTP to email
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide an email address'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'If an account with that email exists, an OTP has been sent.'
      });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Hash OTP before storing
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetOtp = hashedOtp;
    user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY);
    await user.save({ validateBeforeSave: false });

    // Send OTP via email
    try {
      await getResend().emails.send({
        from: 'PawSync <onboarding@resend.dev>',
        to: user.email,
        subject: 'PawSync - Password Reset OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #5A7C7A;">Password Reset</h2>
            <p>Hi ${user.firstName},</p>
            <p>You requested a password reset. Use the following code to verify your identity:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 12px; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
            </div>
            <p style="color: #666;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
            <p style="color: #999; font-size: 12px;">- PawSync Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Reset the OTP fields if email fails
      user.resetOtp = null;
      user.resetOtpExpires = null;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({
        status: 'ERROR',
        message: 'Failed to send OTP email. Please try again.'
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'If an account with that email exists, an OTP has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred. Please try again.'
    });
  }
};

/**
 * Verify OTP
 */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide email and OTP'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+resetOtp +resetOtpExpires');

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid or expired OTP'
      });
    }

    // Check if OTP has expired
    if (user.resetOtpExpires < new Date()) {
      user.resetOtp = null;
      user.resetOtpExpires = null;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        status: 'ERROR',
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Verify OTP
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedOtp !== user.resetOtp) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid OTP'
      });
    }

    // Generate a temporary reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed reset token in OTP field and extend expiry
    user.resetOtp = hashedResetToken;
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min to reset
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'OTP verified successfully',
      data: { resetToken }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred. Please try again.'
    });
  }
};

/**
 * Reset password with reset token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide all required fields'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Password must be at least 6 characters long'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+resetOtp +resetOtpExpires +password');

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid or expired reset token'
      });
    }

    // Check expiry
    if (user.resetOtpExpires < new Date()) {
      user.resetOtp = null;
      user.resetOtpExpires = null;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        status: 'ERROR',
        message: 'Reset token has expired. Please start over.'
      });
    }

    // Verify reset token
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    if (hashedResetToken !== user.resetOtp) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid reset token'
      });
    }

    // Update password
    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred. Please try again.'
    });
  }
};

/**
 * Logout user (frontend handles token removal)
 */
export const logout = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Logout successful. Please remove the token from your client.'
    });
  } catch (error) {
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred during logout'
    });
  }
};
