import { Request, Response } from 'express';
import User from '../models/User';

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

    const { firstName, lastName } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;

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
