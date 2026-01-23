/**
 * Authentication Middleware
 * Handles JWT token validation and role-based access control
 * Requirements: 9.1, 9.5
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '@/services/authService';
import { apiLogger } from '@/utils/logger';
import { createError } from './errorHandler';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        firstName: string;
        lastName: string;
        role: 'user' | 'admin' | 'view-only';
        isActive: boolean;
        lastLogin?: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
        parentUserId?: string | null;
        isViewOnly: boolean;
        autoLoginEnabled: boolean;
        requirePasswordChange: boolean;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError('Access token required', 401);
    }

    const verification = await authService.verifyToken(token);
    
    if (!verification.valid || !verification.user) {
      throw createError(verification.error || 'Invalid token', 401);
    }

    // Add user to request object
    req.user = verification.user;

    // Log the authenticated request
    await authService.logAuditEvent(
      verification.user.id,
      'api_access',
      req.path,
      `${req.method} ${req.path}`,
      req.ip,
      req.get('User-Agent')
    );

    next();
  } catch (error) {
    apiLogger.warn('Authentication failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    next(error);
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (requiredRole: 'user' | 'admin' | 'view-only') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401));
      return;
    }

    // Admin has access to everything
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user has the required role
    if (req.user.role !== requiredRole) {
      apiLogger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole,
        path: req.path
      });
      next(createError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to check specific permission
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const hasPermission = await authService.hasPermission(req.user.id, resource, action);
      
      if (!hasPermission) {
        apiLogger.warn('Permission denied', {
          userId: req.user.id,
          resource,
          action,
          path: req.path
        });
        throw createError('Permission denied', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const verification = await authService.verifyToken(token);
      if (verification.valid && verification.user) {
        req.user = verification.user;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue without user
    next();
  }
};

/**
 * Middleware to extract user info from token for audit logging
 */
export const auditMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Log API access for audit purposes
    const userId = req.user?.id || null;
    const action = `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`;
    
    await authService.logAuditEvent(
      userId,
      action,
      'api',
      `${req.method} ${req.path}`,
      req.ip,
      req.get('User-Agent')
    );

    next();
  } catch (error) {
    // Don't fail the request if audit logging fails
    apiLogger.error('Audit logging failed', { error });
    next();
  }
};

/**
 * Rate limiting middleware per user
 */
export const rateLimitPerUser = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    
    const userLimit = userRequests.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize counter
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (userLimit.count >= maxRequests) {
      apiLogger.warn('Rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        count: userLimit.count
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
      return;
    }

    userLimit.count++;
    next();
  };
};

/**
 * Session validation middleware
 */
export const validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      next();
      return;
    }

    // Check if user is still active
    const currentUser = await authService.getUserById(req.user.id);
    if (!currentUser || !currentUser.isActive) {
      throw createError('User account is inactive', 401);
    }

    // Update user info in request if it has changed
    const { passwordHash, ...userWithoutPassword } = currentUser;
    req.user = userWithoutPassword;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if password change is required
 */
export const checkPasswordChangeRequired = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(createError('Authentication required', 401));
    return;
  }

  // Allow password change endpoint even if password change is required
  if (req.path === '/api/auth/password' || req.path === '/api/users/me/change-password') {
    next();
    return;
  }

  if (req.user.requirePasswordChange) {
    apiLogger.warn('Password change required', {
      userId: req.user.id,
      path: req.path
    });
    
    res.status(403).json({
      success: false,
      error: 'Password change required',
      requirePasswordChange: true,
      message: 'You must change your password before accessing this resource'
    });
    return;
  }

  next();
};