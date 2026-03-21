import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dns from 'dns';
import axios from 'axios';
import User, { IUser } from '../models/User';
import Clinic from '../models/Clinic';
import ClinicBranch from '../models/ClinicBranch';
import { getResend, FROM } from '../services/emailService';

const getJwtSecret = () => process.env.JWT_SECRET || 'your-secret-key';
const getJwtExpire = () => process.env.JWT_EXPIRE || '7d';
const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes
const normalizeContactNumber = (value?: string | null): string => (value || '').replace(/\D/g, '');

/**
 * Check that an email domain has MX records (i.e. it can actually receive mail).
 * Fails closed on all errors — if we cannot confirm the domain is valid, reject it.
 */
async function hasValidEmailDomain(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  // Reject localhost and bare hostnames with no TLD
  if (!domain.includes('.') || domain === 'localhost') return false;
  try {
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('DNS_TIMEOUT')), 5000)
    );
    const lookup = dns.promises.resolveMx(domain);
    const records = await Promise.race([lookup, timeout]) as Awaited<typeof lookup> | null;
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false; // any error (ENOTFOUND, ENODATA, timeout, etc.) — reject
  }
}

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
    if (user.clinicId) payload.clinicId = user.clinicId;
    if (user.clinicBranchId) payload.clinicBranchId = user.clinicBranchId;
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
    const normalizedMobileNumber = normalizeContactNumber(mobileNumber);

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
    if (!normalizedMobileNumber) {
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

    const existingContactUser = await User.findOne({ contactNumberNormalized: normalizedMobileNumber });
    if (existingContactUser) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Mobile number is already registered'
      });
    }

    // Validate that the email domain can actually receive mail (has MX records)
    const domainIsValid = await hasValidEmailDomain(email);
    if (!domainIsValid) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please use a valid email address with a real email provider.'
      });
    }

    // Validate user type
    if (!['pet-owner', 'veterinarian'].includes(userType)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid user type. Must be "pet-owner" or "veterinarian"'
      });
    }

    // Create new user — emailVerified starts as false until they click the link
    const newUser = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      contactNumber: normalizedMobileNumber,
      password,
      userType,
      isVerified: userType !== 'veterinarian',
      emailVerified: false
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    newUser.emailVerificationToken = hashedVerificationToken;
    newUser.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await newUser.save({ validateBeforeSave: false });

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    try {
      await getResend().emails.send({
        from: FROM,
        to: newUser.email,
        subject: 'PawSync – Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #5A7C7A;">Welcome to PawSync, ${newUser.firstName}!</h2>
            <p>Thanks for registering. Please verify your email address to activate your account.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyUrl}" style="background: #7FA5A3; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #666;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
            <p style="color: #999; font-size: 12px;">- PawSync Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Verification email send error:', emailError);
      // Delete the user so they can try again — don't leave an unverifiable account
      await User.deleteOne({ _id: newUser._id });
      return res.status(500).json({
        status: 'ERROR',
        message: 'Failed to send verification email. Please try again.'
      });
    }

    return res.status(201).json({
      status: 'VERIFY_EMAIL',
      message: 'Registration successful. Please check your email to verify your account.'
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

    if (user.userType === 'inactive') {
      return res.status(403).json({
        status: 'ERROR',
        code: 'ACCOUNT_DEACTIVATED',
        message: 'This account has been deactivated after resignation approval.'
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

    // Block login until email is verified (Google users are always verified)
    if (!user.emailVerified) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before logging in.'
      });
    }

    // Check if this clinic-admin or clinic-admin is on the main branch
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
    } else if (user.userType === 'clinic-admin' && user.clinicBranchId && !user.clinicId) {
      // Admin has a branch but clinicId is missing — derive it from the branch document
      const branch = await ClinicBranch.findById(user.clinicBranchId).select('isMain clinicId');
      isMainBranch = !!branch?.isMain;
      if (branch?.clinicId) {
        user.clinicId = branch.clinicId;
      }
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
      isVerified: user.isVerified,
      ...(user.photo && { avatar: user.photo }),
    };

    // Include clinic/branch info for clinic-admin users
    if (user.userType === 'clinic-admin') {
      if (user.clinicId) userData.clinicId = user.clinicId;
      if (user.clinicBranchId) userData.clinicBranchId = user.clinicBranchId;
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
      isVerified: user.isVerified,
      ...(user.photo && { avatar: user.photo }),
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
        from: FROM,
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

/**
 * Verify email address via token link
 * GET /api/auth/verify-email?token=xxx
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ status: 'ERROR', message: 'Verification token is required.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({ status: 'ERROR', message: 'This verification link is invalid or has expired.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validateBeforeSave: false });

    const jwtToken = generateToken(user);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Email verified successfully.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified
        },
        token: jwtToken
      }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred during email verification.' });
  }
};

/**
 * Activate a transfer invitation — set name + password for an invited pet-owner account.
 * POST /api/auth/activate-invitation
 * Body: { token, firstName, lastName, password }
 */
export const activateInvitation = async (req: Request, res: Response) => {
  try {
    const { token, firstName, lastName, password } = req.body;

    if (!token || !firstName?.trim() || !lastName?.trim() || !password) {
      return res.status(400).json({ status: 'ERROR', message: 'All fields are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ status: 'ERROR', message: 'Password must be at least 8 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
      emailVerified: false,
      userType: 'pet-owner',
    }).select('+emailVerificationToken +emailVerificationExpires +password');

    if (!user) {
      return res.status(400).json({ status: 'ERROR', message: 'This invitation link is invalid or has already been used.' });
    }

    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    user.password = password;
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    const jwtToken = generateToken(user);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Account activated successfully.',
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified,
          emailVerified: user.emailVerified,
          photo: user.photo || null,
        },
        token: jwtToken,
      },
    });
  } catch (error) {
    console.error('Activate invitation error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred during account activation.' });
  }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 * Body: { email }
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'ERROR', message: 'Please provide your email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+emailVerificationToken +emailVerificationExpires');

    // Don't reveal if the email is registered or already verified
    if (!user || user.emailVerified) {
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'If your email is registered and unverified, a new verification link has been sent.'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    try {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: 'PawSync – New verification link',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #5A7C7A;">Verify your email, ${user.firstName}</h2>
            <p>Here is your new verification link. It expires in 24 hours.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyUrl}" style="background: #7FA5A3; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">- PawSync Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Resend verification email error:', emailError);
      return res.status(500).json({ status: 'ERROR', message: 'Failed to send verification email. Please try again.' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Verification email sent. Please check your inbox.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred. Please try again.' });
  }
};

/**
 * Google OAuth authentication
 * Accepts a Google access_token, verifies it by calling Google's userinfo endpoint,
 * then creates or finds the user and returns our own JWT.
 *
 * POST /api/auth/google
 * Body: { access_token: string, userType?: 'pet-owner' | 'veterinarian' }
 */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { access_token, userType } = req.body;

    if (!access_token) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Google access token is required'
      });
    }

    // Verify the token and fetch user info from Google
    let googleProfile: { email: string; given_name: string; family_name: string; sub: string };
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      googleProfile = data;
    } catch {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Invalid or expired Google token. Please try again.'
      });
    }

    const { email, given_name, family_name, sub: googleId } = googleProfile;

    if (!email) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Google account must have an email address'
      });
    }

    // Look up user by googleId first, then by email (for account linking)
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }]
    });

    const isNewUser = !user;

    if (!user) {
      // Brand-new user — we need a userType to create the account
      if (!userType || !['pet-owner', 'veterinarian'].includes(userType)) {
        // Tell the frontend to collect the role first
        return res.status(200).json({
          status: 'NEEDS_USER_TYPE',
          message: 'Please select your account type to continue',
          data: {
            email,
            firstName: given_name || '',
            lastName: family_name || ''
          }
        });
      }

      // Create the account (no password — Google is the identity provider)
      // Google has already verified the email address, so emailVerified = true
      user = await User.create({
        email: email.toLowerCase(),
        firstName: given_name || email.split('@')[0],
        lastName: family_name || '',
        googleId,
        userType,
        isVerified: userType !== 'veterinarian',
        emailVerified: true
      });
    } else if (!user.googleId) {
      // Existing email/password account — link the Google ID to it
      user.googleId = googleId;
      await user.save({ validateBeforeSave: false });
    }

    // Determine main-branch status (same logic as regular login)
    let isMainBranch = false;
    if (user.userType === 'clinic-admin' && user.clinicBranchId) {
      const branch = await ClinicBranch.findById(user.clinicBranchId).select('isMain');
      isMainBranch = !!branch?.isMain;
    } else if (user.userType === 'clinic-admin' && !user.clinicBranchId) {
      isMainBranch = true;
    } else if (user.userType === 'clinic-admin' && user.clinicBranchId && !user.clinicId) {
      const branch = await ClinicBranch.findById(user.clinicBranchId).select('isMain clinicId');
      isMainBranch = !!branch?.isMain;
      if (branch?.clinicId) {
        user.clinicId = branch.clinicId;
      }
    }

    const token = generateToken(user, isMainBranch);

    const userData: any = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      userType: user.userType,
      isVerified: user.isVerified,
      ...(user.photo && { avatar: user.photo }),
    };

    if (user.userType === 'clinic-admin') {
      if (user.clinicId) userData.clinicId = user.clinicId;
      if (user.clinicBranchId) userData.clinicBranchId = user.clinicBranchId;
      userData.isMainBranch = isMainBranch;
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: { user: userData, token, isNewUser }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred during Google authentication'
    });
  }
};
