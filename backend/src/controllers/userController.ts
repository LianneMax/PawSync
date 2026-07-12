import { Request, Response } from 'express';
import User from '../models/User';

const normalizeContactNumber = (value?: string | null): string => (value || '').replace(/\D/g, '');

/**
 * Get user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ status: 'ERROR', message: 'User not found' });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified,
          resignation: user.resignation || null,
          contactNumber: user.contactNumber || null,
          photo: user.photo || null,
          signature: user.signature || null,
          reportStyleProfile: user.reportStyleProfile || null,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while fetching profile' });
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ status: 'ERROR', message: 'User not found' });
    }

    if (user.userType === 'veterinarian' && (user.resignation?.status === 'pending' || user.resignation?.status === 'approved')) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Settings are locked while resignation is pending clinic approval.'
      });
    }

    // Email is the account's login identity (unique, and the target for OTP/password-reset).
    // It is intentionally NOT self-editable here — changing it would need verification of the
    // new address. Any `email` in the body is ignored; changes go through support/admin.
    const { firstName, lastName, contactNumber, photo, signature, reportStyleProfile } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (contactNumber !== undefined) {
      const normalizedContact = normalizeContactNumber(contactNumber);
      if (normalizedContact) {
        const existingContactUser = await User.findOne({
          contactNumberNormalized: normalizedContact,
          _id: { $ne: user._id }
        });

        if (existingContactUser) {
          return res.status(409).json({ status: 'ERROR', message: 'Mobile number is already registered' });
        }
      }
      user.contactNumber = normalizedContact || null as any;
    }
    if (photo !== undefined) user.photo = photo;
    if (signature !== undefined) user.signature = signature;
    // Veterinarian-only AI report style preferences (tone/format, never clinical facts).
    if (reportStyleProfile !== undefined && user.userType === 'veterinarian') {
      user.reportStyleProfile = reportStyleProfile === null
        ? null
        : {
            verbosity: reportStyleProfile.verbosity,
            format: reportStyleProfile.format,
            analogies: typeof reportStyleProfile.analogies === 'boolean' ? reportStyleProfile.analogies : undefined,
            readingLevel: reportStyleProfile.readingLevel,
            spelling: reportStyleProfile.spelling,
            extraNotes: typeof reportStyleProfile.extraNotes === 'string' ? reportStyleProfile.extraNotes.slice(0, 300) : undefined,
          };
    }

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          contactNumber: user.contactNumber,
          photo: user.photo || null,
          signature: user.signature || null,
          reportStyleProfile: user.reportStyleProfile || null,
          userType: user.userType,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while updating profile' });
  }
};

/**
 * Change password (while logged in)
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ status: 'ERROR', message: 'Please provide all required fields' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ status: 'ERROR', message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'ERROR', message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user.userId).select('+password');

    if (!user) {
      return res.status(404).json({ status: 'ERROR', message: 'User not found' });
    }

    if (user.userType === 'veterinarian' && (user.resignation?.status === 'pending' || user.resignation?.status === 'approved')) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Password update is disabled while resignation is pending clinic approval.'
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ status: 'ERROR', message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'An error occurred while changing password' });
  }
};
