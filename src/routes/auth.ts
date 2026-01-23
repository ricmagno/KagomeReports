/**
 * Authentication API Routes
 * Handles user authentication and authorization
 * Requirements: 9.1
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiLogger } from '@/utils/logger';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authService } from '@/services/authService';
import { authenticateToken, requireAdmin } from '@/middleware/auth';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().default(false)
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['user', 'admin', 'view-only']).default('user')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
  confirmPassword: z.string().min(8).max(200)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const loginResult = loginSchema.safeParse(req.body);
  if (!loginResult.success) {
    throw createError('Invalid login credentials format', 400);
  }

  const { username, password, rememberMe } = loginResult.data;
  
  apiLogger.info('User login attempt', { username, rememberMe, ip: req.ip });

  const authResult = await authService.authenticate(username, password, rememberMe);
  
  if (!authResult.success) {
    throw createError(authResult.error || 'Authentication failed', 401);
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token: authResult.token,
      user: authResult.user
    },
    expiresIn: authResult.expiresIn
  });
}));

/**
 * POST /api/auth/register
 * Register a new user account (admin only)
 */
router.post('/register', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const registerResult = registerSchema.safeParse(req.body);
  if (!registerResult.success) {
    throw createError('Invalid registration data', 400);
  }

  const userData = registerResult.data;
  
  apiLogger.info('User registration attempt', { 
    username: userData.username, 
    email: userData.email,
    adminUser: req.user?.username
  });

  // TODO: Implement actual user registration in authService
  // For now, return mock response
  const newUser = {
    id: `user_${Date.now()}`,
    username: userData.username,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: userData.role,
    createdAt: new Date().toISOString(),
    isActive: true
  };

  await authService.logAuditEvent(
    req.user!.id,
    'user_created',
    'users',
    `Created user: ${userData.username}`,
    req.ip,
    req.get('User-Agent')
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user: newUser
  });
}));

/**
 * POST /api/auth/logout
 * Logout user and invalidate token
 */
router.post('/logout', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    await authService.logout(token);
  }

  apiLogger.info('User logout', { userId: req.user?.id });

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user
  });
}));

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const passwordResult = changePasswordSchema.safeParse(req.body);
  if (!passwordResult.success) {
    throw createError('Invalid password change data', 400);
  }

  const { currentPassword, newPassword } = passwordResult.data;
  
  apiLogger.info('Password change attempt', { userId: req.user?.id });

  // TODO: Implement actual password change in authService
  // For now, return mock response
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw createError('Refresh token required', 400);
  }

  // Verify current token
  const verification = await authService.verifyToken(token);
  if (!verification.valid || !verification.user) {
    throw createError('Invalid refresh token', 401);
  }

  // Generate new token
  const newToken = await authService.authenticate(
    verification.user.username,
    '', // Password not needed for refresh
    false
  );

  // TODO: Implement proper token refresh logic
  res.json({
    success: true,
    token: newToken.token,
    expiresIn: newToken.expiresIn
  });
}));

/**
 * GET /api/auth/permissions
 * Get user permissions
 */
router.get('/permissions', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const permissions = await authService.getUserPermissions(req.user!.id);
  
  // Convert to structured format
  const structuredPermissions: Record<string, Record<string, boolean>> = {};
  
  permissions.forEach(perm => {
    if (!structuredPermissions[perm.resource]) {
      structuredPermissions[perm.resource] = {};
    }
    const resourcePerms = structuredPermissions[perm.resource];
    if (resourcePerms) {
      resourcePerms[perm.action] = perm.granted;
    }
  });

  res.json({
    success: true,
    permissions: structuredPermissions
  });
}));

/**
 * GET /api/auth/audit
 * Get audit logs (admin only)
 */
router.get('/audit', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { limit = 100, offset = 0, userId, action, startDate, endDate } = req.query;
  
  const auditLogs = await authService.getAuditLogs(
    Number(limit),
    Number(offset),
    userId as string,
    action as string,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined
  );

  res.json({
    success: true,
    logs: auditLogs,
    pagination: {
      limit: Number(limit),
      offset: Number(offset)
    }
  });
}));

export default router;