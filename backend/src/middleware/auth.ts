import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        userType: 'pet-owner' | 'veterinarian' | 'clinic-admin' | 'branch-admin';
        clinicId?: string;
        clinicBranchId?: string;
        branchId?: string;
        isMainBranch?: boolean;
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
      userType: decoded.userType,
      clinicId: decoded.clinicId || undefined,
      clinicBranchId: decoded.clinicBranchId || undefined,
      branchId: decoded.branchId || undefined,
      isMainBranch: decoded.isMainBranch || false
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

/**
 * Middleware to check if user is clinic admin
 */
export const clinicAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Authentication required'
    });
  }

  if (req.user.userType !== 'clinic-admin') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'This endpoint is only available for clinic admins'
    });
  }

  next();
};

/**
 * Middleware to check if user is the main branch admin
 */
export const mainBranchOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Authentication required'
    });
  }

  if (!req.user.isMainBranch) {
    return res.status(403).json({
      status: 'ERROR',
      message: 'Only the main branch admin can perform this action'
    });
  }

  next();
};

/**
 * Middleware to check if user is a branch admin
 */
export const branchAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Authentication required'
    });
  }

  if (req.user.userType !== 'branch-admin') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'This endpoint is only available for branch admins'
    });
  }

  next();
};

/**
 * Middleware to check if user is clinic admin or branch admin
 */
export const clinicOrBranchAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'ERROR',
      message: 'Authentication required'
    });
  }

  if (req.user.userType !== 'clinic-admin' && req.user.userType !== 'branch-admin') {
    return res.status(403).json({
      status: 'ERROR',
      message: 'This endpoint is only available for clinic or branch admins'
    });
  }

  next();
};
