import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

/**
 * Generate JWT token
 */
const generateToken = (user: IUser): string => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      userType: user.userType
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE } as any
  );
};

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, userType } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword || !userType) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Please provide all required fields'
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
      password,
      userType,
      isVerified: userType === 'pet-owner' // Pet owners are auto-verified, vets need license verification
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
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified
        },
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

    return res.status(200).json({
      status: 'SUCCESS',
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
    console.error('Get current user error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An error occurred while fetching user profile'
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
