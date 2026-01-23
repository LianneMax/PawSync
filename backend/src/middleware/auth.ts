import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        userType: 'pet-owner' | 'veterinarian';
      };
    }
  }
}

/**
 * Middleware to verify JWT token
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from headers
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'No token provided. Please log in.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      userType: decoded.userType
    };

    next();
  } catch (error) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Invalid or expired token. Please log in again.'
    });
  }
};

/**
 * Middleware to check if user is veterinarian
 */
export const veterinarianOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Authentication required'
    });
  }

  if (req.user.userType !== 'veterinarian') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'This endpoint is only available for veterinarians'
    });
  }

  next();
};

/**
 * Middleware to check if user is pet owner
 */
export const petOwnerOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Authentication required'
    });
  }

  if (req.user.userType !== 'pet-owner') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'This endpoint is only available for pet owners'
    });
  }

  next();
};
